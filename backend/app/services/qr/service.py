import hashlib
import secrets
import io
import base64
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional
from sqlalchemy.orm import Session
try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

from app.models.entities import Order, QrToken, OrderEvent, Customer


class QrService:
    def __init__(self, token_validity_hours: int = 48):
        self.token_validity_hours = token_validity_hours

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def generate_pickup_token(self, db: Session, order: Order) -> Tuple[str, str, QrToken]:
        """
        Generates a secure single-use pickup token, stores its SHA-256 hash,
        and generates a QR code image as a Base64 data URL.
        """
        # Deactivate any previous active tokens for this order
        db.query(QrToken).filter(
            QrToken.order_id == order.id,
            QrToken.status == "ACTIVE"
        ).update({"status": "REVOKED"})

        raw_token = f"PKUP-{order.order_number}-{secrets.token_urlsafe(24)}"
        token_hash = self.hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=self.token_validity_hours)

        qr_token_entry = QrToken(
            order_id=order.id,
            token_hash=token_hash,
            expires_at=expires_at,
            status="ACTIVE",
            created_at=datetime.now(timezone.utc),
        )
        db.add(qr_token_entry)
        db.commit()
        db.refresh(qr_token_entry)

        # Generate QR image as Data URL
        if HAS_QRCODE:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=8,
                border=2,
            )
            qr.add_data(raw_token)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            qr_data_url = f"data:image/png;base64,{qr_base64}"
        else:
            # Fallback 1x1 transparent png for test environments without PIL/qrcode
            qr_data_url = f"data:text/plain;token={raw_token}"

        return raw_token, qr_data_url, qr_token_entry

    def verify_and_collect_order(
        self, db: Session, raw_token: str, store_id: str, verified_by_user_id: Optional[str] = None
    ) -> Tuple[bool, str, Optional[Order]]:
        """
        Atomic verification and redemption of pickup QR token.
        Enforces tenant isolation, token expiry, status checks, and prevents replay.
        """
        token_hash = self.hash_token(raw_token.strip())

        token_record = (
            db.query(QrToken)
            .filter(QrToken.token_hash == token_hash)
            .with_for_update()  # Lock row to prevent race condition
            .first()
        )

        if not token_record:
            return False, "Invalid pickup token or QR code.", None

        if token_record.status == "REDEEMED":
            return False, f"Token already redeemed on {token_record.redeemed_at}.", None

        if token_record.status != "ACTIVE":
            return False, f"Token is no longer active (status: {token_record.status}).", None

        # Check expiration (safe for both PostgreSQL tz-aware and SQLite tz-naive)
        expires_at = token_record.expires_at
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            now_cmp = now.replace(tzinfo=None)
        else:
            now_cmp = now

        if expires_at < now_cmp:
            token_record.status = "EXPIRED"
            db.commit()
            return False, "Pickup token has expired.", None

        # Check associated order
        order = db.query(Order).filter(Order.id == token_record.order_id).first()
        if not order:
            return False, "Associated order not found.", None

        if order.store_id != store_id:
            return False, "This QR code belongs to a different store.", None

        if order.status == "COLLECTED":
            return False, "Order has already been collected.", None

        if order.status != "READY_FOR_PICKUP":
            return False, f"Order is not ready for pickup (current status: {order.status}).", None

        # Atomic transition to COLLECTED
        previous_status = order.status
        order.status = "COLLECTED"
        order.updated_at = now

        token_record.status = "REDEEMED"
        token_record.redeemed_at = now

        # Add audit trail
        event = OrderEvent(
            order_id=order.id,
            from_status=previous_status,
            to_status="COLLECTED",
            reason="Verified via QR code pickup scan",
            actor_id=verified_by_user_id,
            actor_type="shopkeeper",
            created_at=now,
        )
        db.add(event)

        db.commit()
        db.refresh(order)
        return True, "Order verified and collected successfully!", order


qr_service = QrService()
