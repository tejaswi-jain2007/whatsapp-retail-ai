from pydantic import BaseModel
from typing import Dict, List, Optional
from decimal import Decimal


class PopularProduct(BaseModel):
    product_name: str
    total_quantity: Decimal
    unit: str
    order_count: int


class StoreAnalyticsResponse(BaseModel):
    store_id: str
    store_name: str
    total_orders: int
    new_orders: int
    review_orders: int
    packing_orders: int
    ready_orders: int
    collected_orders: int
    cancelled_orders: int
    total_revenue: Decimal
    average_order_value: Decimal
    orders_by_status: Dict[str, int]
    top_products: List[PopularProduct]

