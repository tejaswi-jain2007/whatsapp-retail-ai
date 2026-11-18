from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.entities import Product, PriceHistory, OrderItem


class PricingProviderAdapter:
    """
    Abstract interface for external market/commodity pricing providers.
    Supports fluctuating commodity rates (e.g. wholesale edible oil rates)
    without hard-coding any specific commercial API.
    """

    def get_reference_price(self, product_name: str, region: str = "IN") -> Optional[Decimal]:
        # Pluggable external reference price feed
        # In MVP, returns simulated/cached reference commodity prices if applicable
        normalized = product_name.lower()
        if "oil" in normalized or "tel" in normalized:
            return Decimal("132.50")
        elif "sugar" in normalized or "cheeni" in normalized:
            return Decimal("46.00")
        elif "atta" in normalized:
            return Decimal("44.00")
        return None

    def get_last_updated(self, product_name: str, region: str = "IN") -> datetime:
        return datetime.now(timezone.utc)


class PricingEngine:
    def __init__(self, provider: Optional[PricingProviderAdapter] = None):
        self.provider = provider or PricingProviderAdapter()

    def update_product_price(
        self,
        db: Session,
        product: Product,
        new_price: Decimal,
        source: str = "manual_override",
        updated_by: Optional[str] = None,
    ) -> Product:
        """
        Updates product price and creates an immutable PriceHistory audit record.
        """
        previous_price = product.current_price
        product.current_price = new_price

        history = PriceHistory(
            product_id=product.id,
            previous_price=previous_price,
            new_price=new_price,
            source=source,
            updated_by=updated_by,
            effective_at=datetime.now(timezone.utc),
        )
        db.add(history)
        db.commit()
        db.refresh(product)
        return product

    def calculate_line_item(
        self,
        quantity: Decimal,
        unit_price: Decimal
    ) -> Decimal:
        """
        Uses Decimal arithmetic to calculate line total = quantity * unit_price
        """
        return (quantity * unit_price).quantize(Decimal("0.01"))

    def get_suggested_retail_price(
        self, product: Product, markup_percentage: Decimal = Decimal("5.0")
    ) -> Optional[Decimal]:
        """
        Calculates suggested price based on external reference rate + store margin.
        """
        ref_price = self.provider.get_reference_price(product.name)
        if ref_price is not None:
            multiplier = Decimal("1.0") + (markup_percentage / Decimal("100.0"))
            return (ref_price * multiplier).quantize(Decimal("0.01"))
        return None


pricing_engine = PricingEngine()
