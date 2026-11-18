from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.entities import Order, OrderItem, OrderEvent, Store, Customer, Notification
from app.services.qr.service import qr_service
from app.services.whatsapp.client import whatsapp_client
from app.services.billing.generator import billing_service


# Valid state transitions graph
VALID_TRANSITIONS = {
    "NEW": ["AI_PROCESSING", "NEEDS_CLARIFICATION", "SHOPKEEPER_REVIEW", "CANCELLED"],
    "AI_PROCESSING": ["NEEDS_CLARIFICATION", "SHOPKEEPER_REVIEW", "CANCELLED"],
    "NEEDS_CLARIFICATION": ["SHOPKEEPER_REVIEW", "CANCELLED", "REJECTED"],
    "SHOPKEEPER_REVIEW": ["CUSTOMER_CONFIRMATION", "CONFIRMED", "CANCELLED", "REJECTED"],
    "CUSTOMER_CONFIRMATION": ["CONFIRMED", "SHOPKEEPER_REVIEW", "CANCELLED", "REJECTED", "EXPIRED"],
    "CONFIRMED": ["PACKING", "CANCELLED"],
    "PACKING": ["PARTIALLY_PACKED", "READY_FOR_PICKUP", "CANCELLED"],
    "PARTIALLY_PACKED": ["PACKING", "READY_FOR_PICKUP", "CANCELLED"],
    "READY_FOR_PICKUP": ["COLLECTED", "CANCELLED"],
    "COLLECTED": [],  # Terminal state
    "REJECTED": [],   # Terminal state
    "CANCELLED": [],  # Terminal state
    "EXPIRED": [],    # Terminal state
}


class OrderLifecycleService:
    def transition_status(
        self,
        db: Session,
        order: Order,
        new_status: str,
        reason: Optional[str] = None,
        actor_id: Optional[str] = None,
        actor_type: str = "shopkeeper",
    ) -> Order:
        """
        Validates and transitions order status according to the finite state machine.
        Logs every transition in order_events table.
        """
        current_status = order.status
        allowed = VALID_TRANSITIONS.get(current_status, [])

        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition order from '{current_status}' to '{new_status}'. Allowed: {allowed}",
            )

        order.status = new_status
        order.updated_at = datetime.now(timezone.utc)

        event = OrderEvent(
            order_id=order.id,
            from_status=current_status,
            to_status=new_status,
            reason=reason,
            actor_id=actor_id,
            actor_type=actor_type,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        db.commit()
        db.refresh(order)
        return order

    async def send_summary_for_customer_confirmation(
        self, db: Session, order: Order, actor_id: Optional[str] = None
    ) -> Order:
        """
        Calculates final bill, changes status to CUSTOMER_CONFIRMATION,
        and sends summary message with interactive buttons to the customer on WhatsApp.
        """
        # Ensure billing / totals are calculated
        billing_service.calculate_order_totals(order)

        # Transition status
        self.transition_status(
            db, order, "CUSTOMER_CONFIRMATION", "Sent order summary to customer", actor_id
        )

        # Format WhatsApp message
        items_summary = "\n".join(
            [f"• {item.product_name_snapshot} ({item.quantity:g} {item.unit}) - ₹{item.total_price:.2f}" for item in order.items]
        )
        summary_text = (
            f"🛒 *Order Summary #{order.order_number}*\n\n"
            f"{items_summary}\n\n"
            f"-------------------------\n"
            f"*Total Bill: ₹{order.grand_total:.2f}*\n"
            f"-------------------------\n\n"
            f"Kya hum yeh saman pack kar dein? Kripya confirm karein:"
        )

        store_phone_id = order.store.whatsapp_phone_number_id if order.store else ""
        cust_phone = order.customer.phone if order.customer else ""

        db.add(
            Notification(
                order_id=order.id,
                channel="whatsapp",
                message_type="CUSTOMER_CONFIRMATION_REQUIRED",
                recipient_phone=cust_phone,
                payload=summary_text,
                status="SENT",
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()

        await whatsapp_client.send_order_confirmation_buttons(
            phone_number_id=store_phone_id,
            recipient_phone=cust_phone,
            order_summary_text=summary_text,
            order_id=order.id,
        )

        return order

    async def update_item_packing_status(
        self,
        db: Session,
        order: Order,
        item_id: str,
        packing_status: str,  # UNPACKED, PACKED, NOT_AVAILABLE
        packed_by: Optional[str] = None,
    ) -> Tuple[Order, OrderItem]:
        """
        Updates packing status for an item. If all items are packed or resolved,
        automatically moves order to READY_FOR_PICKUP, generates QR token,
        and sends WhatsApp notification.
        """
        item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order.id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Order item not found")

        item.packing_status = packing_status
        if packing_status == "PACKED":
            item.packed_quantity = item.quantity
            item.packed_at = datetime.now(timezone.utc)
            item.packed_by = packed_by
        elif packing_status == "UNPACKED":
            item.packed_quantity = Decimal("0.000")
            item.packed_at = None

        db.commit()

        # Check total packing progress
        all_items = order.items
        packed_count = sum(1 for i in all_items if i.packing_status in ["PACKED", "NOT_AVAILABLE"])
        total_items = len(all_items)

        if total_items > 0 and packed_count == total_items:
            # All items are packed! Move to READY_FOR_PICKUP
            if order.status in ["CONFIRMED", "PACKING", "PARTIALLY_PACKED"]:
                self.transition_status(
                    db,
                    order,
                    "READY_FOR_PICKUP",
                    "All items packed and verified by shopkeeper",
                    packed_by,
                )

                # Generate QR pickup token
                raw_token, qr_data_url, _ = qr_service.generate_pickup_token(db, order)

                # Send WhatsApp Ready notification with QR code info
                store_phone_id = order.store.whatsapp_phone_number_id or ""
                cust_phone = order.customer.phone

                pickup_msg = (
                    f"🎉 *Aapka Order #{order.order_number} Ready Hai!*\n\n"
                    f"Store: {order.store.store_name}\n"
                    f"Total Bill: ₹{order.grand_total:.2f}\n\n"
                    f"Aap store aakar saman le sakte hain.\n"
                    f"Pickup Code: *{raw_token}*\n\n"
                    f"Dukandaar ko yeh code dikhayein ya scan karwayein. Dhanyawaad!"
                )
                db.add(
                    Notification(
                        order_id=order.id,
                        channel="whatsapp",
                        message_type="ORDER_READY",
                        recipient_phone=cust_phone,
                        payload=pickup_msg,
                        status="SENT",
                        created_at=datetime.now(timezone.utc),
                    )
                )
                db.commit()

                await whatsapp_client.send_text_message(store_phone_id, cust_phone, pickup_msg)

        elif packed_count > 0:
            if order.status == "CONFIRMED":
                self.transition_status(db, order, "PACKING", "Packing started", packed_by)
            elif order.status == "READY_FOR_PICKUP":
                # Unpacked something after ready
                self.transition_status(db, order, "PARTIALLY_PACKED", "Item unpacked", packed_by)

        db.refresh(order)
        db.refresh(item)
        return order, item


order_lifecycle_service = OrderLifecycleService()

