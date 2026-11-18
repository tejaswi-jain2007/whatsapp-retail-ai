import random
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.entities import (
    Store,
    Customer,
    Order,
    OrderItem,
    OrderEvent,
    MessageEvent,
    Product,
)
from app.services.whatsapp.client import whatsapp_client
from app.services.ai.parser import AIOrderParser, match_item_to_catalogue
from app.utils.phone import normalize_phone_number

ai_parser = AIOrderParser()


class WhatsAppWebhookService:
    def __init__(self):
        self.client = whatsapp_client

    async def process_incoming_webhook(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes Meta WhatsApp Cloud API incoming webhook events.
        """
        entries = payload.get("entry", [])
        processed_count = 0

        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id")

                messages = value.get("messages", [])
                contacts = value.get("contacts", [])

                for msg in messages:
                    msg_id = msg.get("id")
                    from_raw = msg.get("from")
                    msg_type = msg.get("type", "text")

                    # Extract sender contact name if available
                    sender_name = None
                    if contacts:
                        profile = contacts[0].get("profile", {})
                        sender_name = profile.get("name")

                    text_content = ""
                    button_reply_id = None

                    if msg_type == "text":
                        text_content = msg.get("text", {}).get("body", "")
                    elif msg_type == "interactive":
                        interactive = msg.get("interactive", {})
                        if interactive.get("type") == "button_reply":
                            button_reply = interactive.get("button_reply", {})
                            button_reply_id = button_reply.get("id")
                            text_content = button_reply.get("title", "")

                    if not text_content and not button_reply_id:
                        continue

                    await self._handle_single_message(
                        db=db,
                        phone_number_id=phone_number_id,
                        from_raw=from_raw,
                        sender_name=sender_name,
                        msg_id=msg_id,
                        msg_type=msg_type,
                        text_content=text_content,
                        button_reply_id=button_reply_id,
                    )
                    processed_count += 1

        return {"status": "success", "processed_messages": processed_count}

    async def _handle_single_message(
        self,
        db: Session,
        phone_number_id: str,
        from_raw: str,
        sender_name: Optional[str],
        msg_id: str,
        msg_type: str,
        text_content: str,
        button_reply_id: Optional[str] = None,
    ):
        # 1. Identify Store
        store = (
            db.query(Store)
            .filter(Store.whatsapp_phone_number_id == phone_number_id)
            .first()
        )
        if not store:
            # If not found by phone_number_id, fallback to first active store in dev
            store = db.query(Store).filter(Store.status == "active").first()
            if not store:
                return

        normalized_phone = normalize_phone_number(from_raw)

        # 2. Deduplicate message
        existing_event = (
            db.query(MessageEvent)
            .filter(MessageEvent.whatsapp_message_id == msg_id)
            .first()
        )
        if existing_event:
            return  # Prevent duplicate processing

        # 3. Identify / Automatically create customer
        customer = (
            db.query(Customer)
            .filter(Customer.store_id == store.id, Customer.phone == normalized_phone)
            .first()
        )
        if not customer:
            customer = Customer(
                store_id=store.id,
                phone=normalized_phone,
                name=sender_name,
                whatsapp_consent=True,
                call_consent=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
        elif sender_name and not customer.name:
            customer.name = sender_name
            db.commit()

        # Log MessageEvent
        event_record = MessageEvent(
            store_id=store.id,
            customer_id=customer.id,
            whatsapp_message_id=msg_id,
            message_type=msg_type,
            sender_phone=normalized_phone,
            message_content=text_content,
            processing_status="PROCESSING",
            received_at=datetime.now(timezone.utc),
        )
        db.add(event_record)
        db.commit()

        # 4. Check for interactive reply or confirmation keyword
        if button_reply_id or self._is_confirmation_reply(text_content):
            await self._process_customer_confirmation_reply(
                db, store, customer, text_content, button_reply_id
            )
            event_record.processing_status = "PROCESSED"
            db.commit()
            return

        # 5. Process new order shopping list
        await self._process_new_order(db, store, customer, text_content)
        event_record.processing_status = "PROCESSED"
        db.commit()

    def _is_confirmation_reply(self, text: str) -> bool:
        normalized = text.lower().strip()
        confirm_words = ["confirm", "yes", "ok", "haan", "sahi hai", "theek hai", "accept"]
        return any(w in normalized for w in confirm_words)

    async def _process_customer_confirmation_reply(
        self,
        db: Session,
        store: Store,
        customer: Customer,
        text_content: str,
        button_reply_id: Optional[str],
    ):
        # Find latest order awaiting customer confirmation
        order = (
            db.query(Order)
            .filter(
                Order.store_id == store.id,
                Order.customer_id == customer.id,
                Order.status == "CUSTOMER_CONFIRMATION",
            )
            .order_by(Order.created_at.desc())
            .first()
        )

        if not order:
            return

        is_cancel = (button_reply_id and "CANCEL" in button_reply_id) or "cancel" in text_content.lower()
        is_modify = (button_reply_id and "MODIFY" in button_reply_id) or "modify" in text_content.lower()

        if is_cancel:
            order.status = "CANCELLED"
            db.add(
                OrderEvent(
                    order_id=order.id,
                    from_status="CUSTOMER_CONFIRMATION",
                    to_status="CANCELLED",
                    reason="Customer cancelled via WhatsApp",
                    actor_type="customer",
                )
            )
            db.commit()
            await self.client.send_text_message(
                store.whatsapp_phone_number_id or "",
                customer.phone,
                f"Aapka order #{order.order_number} cancel kar diya gaya hai. Dhanyawaad!",
            )
        elif is_modify:
            order.status = "SHOPKEEPER_REVIEW"
            order.clarification_notes = f"Customer requested modification: {text_content}"
            db.add(
                OrderEvent(
                    order_id=order.id,
                    from_status="CUSTOMER_CONFIRMATION",
                    to_status="SHOPKEEPER_REVIEW",
                    reason=f"Customer requested modification: {text_content}",
                    actor_type="customer",
                )
            )
            db.commit()
            await self.client.send_text_message(
                store.whatsapp_phone_number_id or "",
                customer.phone,
                f"Aapki modification request mil gayi hai. Dukandaar check karke update bhejenge.",
            )
        else:
            # Confirm
            order.status = "CONFIRMED"
            db.add(
                OrderEvent(
                    order_id=order.id,
                    from_status="CUSTOMER_CONFIRMATION",
                    to_status="CONFIRMED",
                    reason="Customer confirmed via WhatsApp",
                    actor_type="customer",
                )
            )
            db.commit()
            await self.client.send_text_message(
                store.whatsapp_phone_number_id or "",
                customer.phone,
                f"✅ Dhanyawaad! Order #{order.order_number} confirm ho gaya hai. Dukandaar saman pack kar rahe hain.",
            )

    async def _process_new_order(
        self, db: Session, store: Store, customer: Customer, text_content: str
    ):
        # AI parsing
        ai_result = ai_parser.parse_message(text_content)

        # Generate unique order number: ORD-YYYYMMDD-XXXX
        date_str = datetime.now().strftime("%y%m%d")
        rand_suffix = str(random.randint(1000, 9999))
        order_number = f"ORD-{date_str}-{rand_suffix}"

        status = "SHOPKEEPER_REVIEW"
        clarification_notes = None
        if ai_result.requires_clarification:
            status = "NEEDS_CLARIFICATION"
            clarification_notes = ai_result.clarification_reason

        order = Order(
            store_id=store.id,
            customer_id=customer.id,
            order_number=order_number,
            original_message=text_content,
            status=status,
            subtotal=Decimal("0.00"),
            discount=Decimal("0.00"),
            tax=Decimal("0.00"),
            grand_total=Decimal("0.00"),
            clarification_notes=clarification_notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(order)
        db.flush()

        # Match items against store catalogue
        catalogue = db.query(Product).filter(Product.store_id == store.id).all()
        subtotal = Decimal("0.00")

        for parsed_item in ai_result.items:
            matched_prod, unit_price = match_item_to_catalogue(parsed_item, catalogue)
            total_price = (parsed_item.quantity * unit_price).quantize(Decimal("0.01"))
            subtotal += total_price

            item_name = matched_prod.name if matched_prod else parsed_item.product_name

            order_item = OrderItem(
                order_id=order.id,
                product_id=matched_prod.id if matched_prod else None,
                product_name_snapshot=item_name,
                quantity=parsed_item.quantity,
                unit=parsed_item.unit,
                unit_price=unit_price,
                total_price=total_price,
                packing_status="UNPACKED",
            )
            db.add(order_item)

        order.subtotal = subtotal
        order.grand_total = subtotal

        # Audit event
        db.add(
            OrderEvent(
                order_id=order.id,
                from_status="NEW",
                to_status=status,
                reason="Created from WhatsApp inbound message",
                actor_type="system",
            )
        )
        db.commit()
        db.refresh(order)

        # Send acknowledgment to customer
        store_display = store.store_name
        ack_message = (
            f"Namaste! {store_display} ko aapka order mil gaya hai.\n"
            f"Order ID: #{order.order_number}\n\n"
            f"Dukandaar saman aur keemat check karke aapko final bill bhejenge. Kripya thoda intezaar karein."
        )
        await self.client.send_text_message(
            store.whatsapp_phone_number_id or "",
            customer.phone,
            ack_message,
        )


whatsapp_webhook_service = WhatsAppWebhookService()
