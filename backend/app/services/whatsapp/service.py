import re
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
    Notification,
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
        # 1. Identify Store (by WhatsApp Phone Number ID or Shopkeeper Mobile Number)
        store = None
        if phone_number_id:
            store = (
                db.query(Store)
                .filter(Store.whatsapp_phone_number_id == phone_number_id)
                .first()
            )
            if not store:
                normalized_target = normalize_phone_number(phone_number_id)
                store = (
                    db.query(Store)
                    .filter(Store.phone == normalized_target)
                    .first()
                )

        if not store:
            # Fallback to first store in local dev
            store = db.query(Store).filter(Store.status == "active").first() or db.query(Store).first()
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

        # Check store subscription & pause state (14-Day Free Trial / ₹299/mo renewal)
        now = datetime.now(timezone.utc)
        is_expired = False

        if store.subscription_status == "trial" and store.trial_ends_at:
            t_end = store.trial_ends_at
            if t_end.tzinfo is None:
                t_end = t_end.replace(tzinfo=timezone.utc)
            if now > t_end:
                store.subscription_status = "expired"
                store.status = "paused"
                db.commit()
                is_expired = True
        elif store.subscription_status == "active" and store.subscription_valid_until:
            s_end = store.subscription_valid_until
            if s_end.tzinfo is None:
                s_end = s_end.replace(tzinfo=timezone.utc)
            if now > s_end:
                store.subscription_status = "expired"
                store.status = "paused"
                db.commit()
                is_expired = True

        if store.status == "paused" or store.subscription_status == "expired" or is_expired:
            notice = (
                f"⚠️ *Namaste!*\n\n"
                f"*{store.store_name}* ka 14-din ka free trial poora ho gaya hai aur store abhi *PAUSED* hai.\n\n"
                f"Dukandaar subscription renew kar rahe hain (₹299/month). Renew hote hi WhatsApp orders wapas shuru ho jayenge.\n\n"
                f"Asuvidha ke liye khed hai! 🙏"
            )
            await self.client.send_text_message(
                phone_number_id=store.whatsapp_phone_number_id or phone_number_id or "default",
                recipient_phone=normalized_phone,
                text=notice,
            )

            # Create in-app notification for the shopkeeper
            notif = Notification(
                store_id=store.id,
                channel="IN_APP",
                recipient=store.phone,
                content=f"⚠️ Order Blocked: Customer (+{normalized_phone}) ne message bheja, par aapka 14-Day Trial khatam hone se store PAUSED hai. Naye orders lene ke liye ₹299/month subscription renew karein.",
                status="SENT",
            )
            db.add(notif)
            event_record.processing_status = "PAUSED_TRIAL_EXPIRED"
            db.commit()
            return

        # 4. Check for interactive reply or confirmation on pending orders
        related_customer_ids = [customer.id]
        if customer.name:
            for c in db.query(Customer).filter(Customer.store_id == store.id, Customer.name == customer.name).all():
                if c.id not in related_customer_ids:
                    related_customer_ids.append(c.id)

        # Prioritize order waiting for CUSTOMER_CONFIRMATION with real items / grand_total > 0
        pending_order = (
            db.query(Order)
            .filter(
                Order.store_id == store.id,
                Order.customer_id.in_(related_customer_ids),
                Order.status == "CUSTOMER_CONFIRMATION",
                Order.grand_total > Decimal("0.00"),
            )
            .order_by(Order.created_at.desc())
            .first()
        )
        if not pending_order:
            pending_order = (
                db.query(Order)
                .filter(
                    Order.store_id == store.id,
                    Order.customer_id.in_(related_customer_ids),
                    Order.status == "CUSTOMER_CONFIRMATION",
                )
                .order_by(Order.created_at.desc())
                .first()
            )
        if not pending_order:
            pending_order = (
                db.query(Order)
                .filter(
                    Order.store_id == store.id,
                    Order.customer_id.in_(related_customer_ids),
                    Order.status.in_(["SHOPKEEPER_REVIEW", "NEW", "NEEDS_CLARIFICATION"]),
                )
                .order_by(Order.created_at.desc())
                .first()
            )

        if pending_order and (button_reply_id or self._is_confirmation_reply(text_content)):
            await self._process_customer_confirmation_reply(
                db, store, customer, text_content, button_reply_id, pending_order
            )
            event_record.processing_status = "PROCESSED"
            db.commit()
            return
        elif button_reply_id or self._is_confirmation_reply(text_content):
            # Check if customer has an already confirmed / ready order
            active_order = (
                db.query(Order)
                .filter(
                    Order.store_id == store.id,
                    Order.customer_id.in_(related_customer_ids),
                    Order.status.in_(["CONFIRMED", "PACKING", "PARTIALLY_PACKED", "READY_FOR_PICKUP"]),
                )
                .order_by(Order.created_at.desc())
                .first()
            )
            if active_order:
                pin = active_order.order_number.split("-")[-1]
                status_desc = "pack ho kar tayyar hai" if active_order.status == "READY_FOR_PICKUP" else "pack ho raha hai"
                reassure_msg = f"Aapka order #{active_order.order_number} pehle se confirm hai aur dukan par {status_desc}."
                if active_order.status == "READY_FOR_PICKUP":
                    reassure_msg += f"\n🔢 Pickup PIN: *{pin}*"
                await self.client.send_text_message(store.whatsapp_phone_number_id or "", customer.phone, reassure_msg)
                event_record.processing_status = "PROCESSED"
                db.commit()
                return

            await self._process_customer_confirmation_reply(
                db, store, customer, text_content, button_reply_id
            )
            event_record.processing_status = "PROCESSED"
            db.commit()
            return

        # 5. PRIVACY SHIELD & RETAIL INTENT CHECK
        # Parse message with AI to see if it contains genuine shopping list / grocery items
        ai_result = ai_parser.parse_message(text_content)

        if not ai_result.is_shopping_order or not ai_result.items:
            # Message is personal (family/friends/casual chat). Protect shopkeeper privacy!
            # Do NOT create order, do NOT send store acknowledgment, do NOT expose on dashboard.
            event_record.processing_status = "IGNORED"
            event_record.message_content = "[PERSONAL_MESSAGE_IGNORED_FOR_PRIVACY]"
            db.commit()
            print(f"[PrivacyShield] Non-shopping personal chat from {normalized_phone} safely ignored. No order created.")
            return

        # 6. Process new order shopping list
        await self._process_new_order(db, store, customer, text_content, ai_result)
        event_record.processing_status = "PROCESSED"
        db.commit()

    def _is_confirmation_reply(self, text: str) -> bool:
        normalized = text.lower().strip()
        cleaned = re.sub(r'[^\w\s]', '', normalized).strip()

        # 1. Direct tokens
        direct_tokens = {
            "1", "2", "yes", "y", "ok", "okay", "k", "done", "sure", "accept",
            "confirm", "confirmed", "sahi", "theek", "thik", "pack", "bhej",
            "no", "n", "nahi", "nahin", "nhi", "cancel", "radd", "modify",
            "ha", "haa", "haaa", "haaaa", "haan", "haaan", "han", "haji",
            "ha ji", "haa ji", "haan ji", "sahi hai", "theek hai", "thik hai"
        }
        if cleaned in direct_tokens or normalized in direct_tokens:
            return True

        # 2. Regex for any variation of ha/haa/haan with optional 'ji'
        if re.fullmatch(r'h[a]+[n]?(?:\s*ji)?', cleaned):
            return True

        # 3. Number prefix answers like "1.", "1 - yes", "1 confirm", "1 haan"
        if re.match(r'^[12]\b', cleaned):
            return True

        # 4. Phrase containment
        confirm_phrases = [
            "confirm", "yes", "ok", "haan", "haa", "ha ji", "sahi hai", "sahi h",
            "theek hai", "theek h", "thik hai", "thik h", "pack kar", "pack kardo",
            "pack krdo", "pack kr dena", "bhej do", "bhej dena", "kar do", "kardo",
            "cancel", "radd", "modify", "badal do"
        ]
        return any(p in cleaned for p in confirm_phrases)

    async def _process_customer_confirmation_reply(
        self,
        db: Session,
        store: Store,
        customer: Customer,
        text_content: str,
        button_reply_id: Optional[str],
        order: Optional[Order] = None,
    ):
        if not order:
            related_customer_ids = [customer.id]
            if customer.name:
                for c in db.query(Customer).filter(Customer.store_id == store.id, Customer.name == customer.name).all():
                    if c.id not in related_customer_ids:
                        related_customer_ids.append(c.id)

            # Prioritize CUSTOMER_CONFIRMATION with real items / grand_total > 0
            order = (
                db.query(Order)
                .filter(
                    Order.store_id == store.id,
                    Order.customer_id.in_(related_customer_ids),
                    Order.status == "CUSTOMER_CONFIRMATION",
                    Order.grand_total > Decimal("0.00"),
                )
                .order_by(Order.created_at.desc())
                .first()
            )
            if not order:
                order = (
                    db.query(Order)
                    .filter(
                        Order.store_id == store.id,
                        Order.customer_id.in_(related_customer_ids),
                        Order.status == "CUSTOMER_CONFIRMATION",
                    )
                    .order_by(Order.created_at.desc())
                    .first()
                )
            if not order:
                order = (
                    db.query(Order)
                    .filter(
                        Order.store_id == store.id,
                        Order.customer_id.in_(related_customer_ids),
                        Order.status.in_(["SHOPKEEPER_REVIEW", "NEW", "NEEDS_CLARIFICATION"]),
                    )
                    .order_by(Order.created_at.desc())
                    .first()
                )

        if not order:
            await self.client.send_text_message(
                store.whatsapp_phone_number_id or "",
                customer.phone,
                "Aapka koi pending order confirm karne ke liye nahi mila. Saman mangwane ke liye list bhejein.",
            )
            return

        normalized = text_content.lower().strip()
        is_cancel = (
            (button_reply_id and "CANCEL" in button_reply_id)
            or normalized in ["2", "cancel", "no", "nhi", "nahin", "radd"]
            or "cancel" in normalized
        )
        is_modify = (
            (button_reply_id and "MODIFY" in button_reply_id)
            or normalized in ["modify", "change", "badal do"]
            or "modify" in normalized
        )

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
            previous_status = order.status
            order.status = "CONFIRMED"
            db.add(
                OrderEvent(
                    order_id=order.id,
                    from_status=previous_status,
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
        self, db: Session, store: Store, customer: Customer, text_content: str, ai_result=None
    ):
        # AI parsing if not already parsed
        if not ai_result:
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
        db.add(
            Notification(
                order_id=order.id,
                channel="whatsapp",
                message_type="ORDER_ACK",
                recipient_phone=customer.phone,
                payload=ack_message,
                status="SENT",
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()

        await self.client.send_text_message(
            store.whatsapp_phone_number_id or "",
            customer.phone,
            ack_message,
        )


whatsapp_webhook_service = WhatsAppWebhookService()

