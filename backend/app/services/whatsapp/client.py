import hmac
import hashlib
from typing import Optional, Dict, Any, List
import httpx
from app.config.settings import settings


class WhatsAppCloudClient:
    """
    Client for the official Meta WhatsApp Business Cloud API.
    """

    def __init__(self):
        self.api_version = settings.WHATSAPP_API_VERSION
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.app_secret = settings.WHATSAPP_APP_SECRET
        self.base_url = f"https://graph.facebook.com/{self.api_version}"

    def verify_webhook_signature(self, raw_body: bytes, signature_header: Optional[str]) -> bool:
        """
        Verifies Meta X-Hub-Signature-256 against configured APP_SECRET.
        """
        if not self.app_secret:
            # In local development if app secret is not configured, pass validation
            return True

        if not signature_header:
            return False

        if signature_header.startswith("sha256="):
            signature_header = signature_header[7:]

        expected = hmac.new(
            key=self.app_secret.encode("utf-8"),
            msg=raw_body,
            digestmod=hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, signature_header)

    async def send_text_message(
        self, phone_number_id: str, recipient_phone: str, text: str
    ) -> Dict[str, Any]:
        """
        Sends a standard text message to a customer on WhatsApp.
        """
        # Clean recipient phone (strip leading + for WhatsApp API)
        to_phone = recipient_phone.replace("+", "").strip()

        if not self.access_token or self.access_token == "your_meta_system_user_token":
            # Mock sending for dev/testing
            return {
                "messaging_product": "whatsapp",
                "contacts": [{"input": to_phone, "wa_id": to_phone}],
                "messages": [{"id": f"wamid.mock.{to_phone}"}],
            }

        url = f"{self.base_url}/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "text",
            "text": {"preview_url": False, "body": text},
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()

    async def send_order_confirmation_buttons(
        self, phone_number_id: str, recipient_phone: str, order_summary_text: str, order_id: str
    ) -> Dict[str, Any]:
        """
        Sends an interactive message with Quick Reply buttons (Confirm, Modify, Cancel).
        """
        to_phone = recipient_phone.replace("+", "").strip()

        if not self.access_token or self.access_token == "your_meta_system_user_token":
            return {
                "messaging_product": "whatsapp",
                "messages": [{"id": f"wamid.mock.buttons.{to_phone}"}],
            }

        url = f"{self.base_url}/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": order_summary_text},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": f"CONFIRM_{order_id}", "title": "✅ Confirm Order"}},
                        {"type": "reply", "reply": {"id": f"MODIFY_{order_id}", "title": "✏️ Modify Items"}},
                        {"type": "reply", "reply": {"id": f"CANCEL_{order_id}", "title": "❌ Cancel"}},
                    ]
                },
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()


whatsapp_client = WhatsAppCloudClient()
