from collections import defaultdict
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.session import get_db
from app.models.entities import Order, OrderItem, Store, User
from app.schemas.analytics import StoreAnalyticsResponse, PopularProduct
from app.api.deps import get_current_user, verify_store_access

router = APIRouter(tags=["Analytics"])


@router.get("/stores/{store_id}/analytics", response_model=StoreAnalyticsResponse)
def get_store_analytics(
    store_id: str,
    db: Session = Depends(get_db),
    _store: Store = Depends(verify_store_access),
):
    orders = db.query(Order).filter(Order.store_id == store_id).all()

    total_orders = len(orders)
    status_counts = defaultdict(int)
    total_revenue = Decimal("0.00")
    collected_orders_count = 0

    for ord in orders:
        status_counts[ord.status] += 1
        if ord.status in ["CONFIRMED", "PACKING", "PARTIALLY_PACKED", "READY_FOR_PICKUP", "COLLECTED"]:
            total_revenue += ord.grand_total
        if ord.status == "COLLECTED":
            collected_orders_count += 1

    avg_order_val = (
        (total_revenue / Decimal(str(total_orders))).quantize(Decimal("0.01"))
        if total_orders > 0
        else Decimal("0.00")
    )

    # Calculate top products
    item_aggregation = (
        db.query(
            OrderItem.product_name_snapshot,
            OrderItem.unit,
            func.sum(OrderItem.quantity).label("total_qty"),
            func.count(OrderItem.id).label("order_count"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.store_id == store_id)
        .group_by(OrderItem.product_name_snapshot, OrderItem.unit)
        .order_by(func.count(OrderItem.id).desc())
        .limit(5)
        .all()
    )

    top_products = [
        PopularProduct(
            product_name=row[0],
            unit=row[1],
            total_quantity=Decimal(str(row[2])),
            order_count=row[3],
        )
        for row in item_aggregation
    ]

    return StoreAnalyticsResponse(
        store_id=store_id,
        store_name=_store.store_name,
        total_orders=total_orders,
        new_orders=status_counts["NEW"],
        review_orders=status_counts["SHOPKEEPER_REVIEW"],
        packing_orders=status_counts["PACKING"] + status_counts["PARTIALLY_PACKED"],
        ready_orders=status_counts["READY_FOR_PICKUP"],
        collected_orders=status_counts["COLLECTED"],
        cancelled_orders=status_counts["CANCELLED"],
        total_revenue=total_revenue,
        average_order_value=avg_order_val,
        orders_by_status=dict(status_counts),
        top_products=top_products,
    )

