from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal


class AIParsedItem(BaseModel):
    product_name: str
    brand: Optional[str] = None
    variant: Optional[str] = None
    quantity: Decimal = Decimal("1.0")
    unit: str = "packet"


class AIParsedResponse(BaseModel):
    items: List[AIParsedItem] = Field(default_factory=list)
    requires_clarification: bool = False
    clarification_reason: Optional[str] = None
