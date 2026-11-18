from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict


class WhatsAppVerificationQuery(BaseModel):
    hub_mode: Optional[str] = Field(None, alias="hub.mode")
    hub_challenge: Optional[str] = Field(None, alias="hub.challenge")
    hub_verify_token: Optional[str] = Field(None, alias="hub.verify_token")


class WhatsAppText(BaseModel):
    body: str


class WhatsAppInteractiveButtonReply(BaseModel):
    id: str
    title: str


class WhatsAppInteractive(BaseModel):
    type: str
    button_reply: Optional[WhatsAppInteractiveButtonReply] = None


class WhatsAppMessageItem(BaseModel):
    id: str
    from_: str = Field(..., alias="from")
    timestamp: str
    type: str = "text"
    text: Optional[WhatsAppText] = None
    interactive: Optional[WhatsAppInteractive] = None


class WhatsAppMetadata(BaseModel):
    display_phone_number: Optional[str] = None
    phone_number_id: str


class WhatsAppContact(BaseModel):
    profile: Optional[Dict[str, Any]] = None
    wa_id: str


class WhatsAppChangeValue(BaseModel):
    messaging_product: str
    metadata: WhatsAppMetadata
    contacts: Optional[List[WhatsAppContact]] = None
    messages: Optional[List[WhatsAppMessageItem]] = None
    statuses: Optional[List[Dict[str, Any]]] = None


class WhatsAppChange(BaseModel):
    value: WhatsAppChangeValue
    field: str


class WhatsAppEntry(BaseModel):
    id: str
    changes: List[WhatsAppChange]


class WhatsAppWebhookPayload(BaseModel):
    object: str
    entry: List[WhatsAppEntry]
