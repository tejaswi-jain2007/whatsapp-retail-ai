from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database.session import get_db
from app.config.settings import settings
from app.services.whatsapp.service import whatsapp_webhook_service
from app.services.whatsapp.client import whatsapp_client

router = APIRouter(prefix="/webhooks", tags=["WhatsApp Webhooks"])


class SimulateWhatsAppMessageRequest(BaseModel):
    store_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    sender_phone: str = "+919876543210"
    sender_name: Optional[str] = "Priya Sharma"
    message_text: str
    message_id: Optional[str] = None


@router.get("/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """
    Endpoint for Meta WhatsApp Cloud API Webhook verification handshake.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/whatsapp")
async def handle_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: Optional[str] = Header(None),
):
    """
    Inbound Meta WhatsApp Cloud API webhook receiver.
    Verifies HMAC-SHA256 signature and processes messages.
    """
    raw_body = await request.body()

    if not whatsapp_client.verify_webhook_signature(raw_body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    result = await whatsapp_webhook_service.process_incoming_webhook(db, payload)
    return result


@router.post("/simulate")
async def simulate_incoming_whatsapp_message(
    data: SimulateWhatsAppMessageRequest,
    db: Session = Depends(get_db),
):
    """
    Convenient developer endpoint to simulate an incoming customer WhatsApp message.
    Translates request into standard Meta WhatsApp Cloud webhook format and processes it.
    """
    import uuid
    import time

    msg_id = data.message_id or f"wamid.sim.{uuid.uuid4().hex[:12]}"
    phone_id = data.phone_number_id or "WA_PHONE_ID_1001"

    simulated_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WABA_SIMULATED",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "+919876543210",
                                "phone_number_id": phone_id,
                            },
                            "contacts": [
                                {
                                    "profile": {"name": data.sender_name},
                                    "wa_id": data.sender_phone.replace("+", ""),
                                }
                            ],
                            "messages": [
                                {
                                    "id": msg_id,
                                    "from": data.sender_phone,
                                    "timestamp": str(int(time.time())),
                                    "type": "text",
                                    "text": {"body": data.message_text},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    result = await whatsapp_webhook_service.process_incoming_webhook(db, simulated_payload)
    return {"status": "success", "result": result, "simulated_message_id": msg_id}
