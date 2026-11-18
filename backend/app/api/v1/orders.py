import random
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import Order, OrderItem, Customer, User
from app.schemas.order import (
    OrderResponse,
    OrderCreate,
    OrderReviewUpdate,
    OrderStatusUpdate,
    OrderCustomerConfirm,
    OrderItemResponse,
)
from app.api.deps import get_current_user, verify_store_access
from app.services.orders.lifecycle import order_lifecycle_service
from app.services.billing.generator import billing_service

router = APIRouter(tags=["Orders"])


@router.get("/stores/{store_id}/orders", response_model=List[OrderResponse])
def list_store_orders(
    store_id: str,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _store=Depends(verify_store_access),
):
    query = db.query(Order).filter(Order.store_id == store_id)
    if status_filter:
        query = query.filter(Order.status == status_filter)
    return query.order_by(Order.created_at.desc()).all()


@router.post("/stores/{store_id}/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_manual_order(
    store_id: str,
    data: OrderCreate,
    db: Session = Depends(get_db),
    _store=Depends(verify_store_access),
):
    date_str = datetime.now().strftime("%y%m%d")
    rand_suffix = str(random.randint(1000, 9999))
    order_number = f"ORD-{date_str}-{rand_suffix}"

    order = Order(
        store_id=store_id,
        customer_id=data.customer_id,
        order_number=order_number,
        original_message=data.original_message,
        status="SHOPKEEPER_REVIEW",
        subtotal=Decimal("0.00"),
        discount=data.discount,
        tax=data.tax,
        grand_total=Decimal("0.00"),
    )
    db.add(order)
    db.flush()

    subtotal = Decimal("0.00")
    for item_data in data.items:
        line_total = (item_data.quantity * item_data.unit_price).quantize(Decimal("0.01"))
        subtotal += line_total
        item = OrderItem(
            order_id=order.id,
            product_id=item_data.product_id,
            product_name_snapshot=item_data.product_name_snapshot,
            quantity=item_data.quantity,
            unit=item_data.unit,
            unit_price=item_data.unit_price,
            total_price=line_total,
            packing_status=item_data.packing_status,
        )
        db.add(item)

    order.subtotal = subtotal
    order.grand_total = (subtotal - data.discount + data.tax).quantize(Decimal("0.01"))

    db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order_details(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)
    return order


@router.put("/orders/{order_id}/review", response_model=OrderResponse)
def review_and_update_order(
    order_id: str,
    data: OrderReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    if order.status not in ["NEW", "NEEDS_CLARIFICATION", "SHOPKEEPER_REVIEW"]:
        raise HTTPException(
            status_code=400,
            detail=f"Order in status '{order.status}' cannot be modified by review.",
        )

    # Update discount & tax if provided
    if data.discount is not None:
        order.discount = data.discount
    if data.tax is not None:
        order.tax = data.tax
    if data.clarification_notes is not None:
        order.clarification_notes = data.clarification_notes

    # Update or add items
    for item_data in data.items:
        if item_data.id:
            item = db.query(OrderItem).filter(OrderItem.id == item_data.id, OrderItem.order_id == order.id).first()
            if item:
                if item_data.product_id is not None:
                    item.product_id = item_data.product_id
                if item_data.product_name_snapshot is not None:
                    item.product_name_snapshot = item_data.product_name_snapshot
                if item_data.quantity is not None:
                    item.quantity = item_data.quantity
                if item_data.unit is not None:
                    item.unit = item_data.unit
                if item_data.unit_price is not None:
                    item.unit_price = item_data.unit_price
                if item_data.packing_status is not None:
                    item.packing_status = item_data.packing_status
                item.total_price = (item.quantity * item.unit_price).quantize(Decimal("0.01"))
        else:
            # New item added manually by shopkeeper
            qty = item_data.quantity or Decimal("1.0")
            price = item_data.unit_price or Decimal("0.00")
            new_item = OrderItem(
                order_id=order.id,
                product_id=item_data.product_id,
                product_name_snapshot=item_data.product_name_snapshot or "Custom Item",
                quantity=qty,
                unit=item_data.unit or "piece",
                unit_price=price,
                total_price=(qty * price).quantize(Decimal("0.01")),
                packing_status=item_data.packing_status or "UNPACKED",
            )
            db.add(new_item)

    billing_service.calculate_order_totals(order)
    order.status = "SHOPKEEPER_REVIEW"
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/send-summary", response_model=OrderResponse)
async def send_summary_to_customer(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    updated = await order_lifecycle_service.send_summary_for_customer_confirmation(
        db, order, actor_id=current_user.id
    )
    return updated


@router.post("/orders/{order_id}/confirm", response_model=OrderResponse)
def confirm_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    updated = order_lifecycle_service.transition_status(
        db, order, "CONFIRMED", reason="Confirmed by shopkeeper", actor_id=current_user.id
    )
    return updated


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    updated = order_lifecycle_service.transition_status(
        db, order, data.status, reason=data.reason, actor_id=current_user.id
    )
    return updated


@router.patch("/orders/{order_id}/items/{item_id}/packing", response_model=OrderItemResponse)
async def update_item_packing(
    order_id: str,
    item_id: str,
    packing_status: str,  # UNPACKED, PACKED, NOT_AVAILABLE
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    _, updated_item = await order_lifecycle_service.update_item_packing_status(
        db, order, item_id, packing_status, packed_by=current_user.id
    )
    return updated_item


@router.get("/orders/{order_id}/chat")
def get_order_chat_thread(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the real-time chronological WhatsApp chat thread between customer and store for this order.
    """
    from app.models.entities import MessageEvent, Notification
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    # 1. Customer inbound messages
    inbound_msgs = (
        db.query(MessageEvent)
        .filter(MessageEvent.customer_id == order.customer_id)
        .all()
    )

    # 2. Outbound notifications/messages sent by store
    outbound_msgs = (
        db.query(Notification)
        .filter(Notification.order_id == order.id)
        .all()
    )

    thread = []
    for m in inbound_msgs:
        thread.append({
            "id": m.id,
            "sender": "customer",
            "sender_name": order.customer.name or "Customer",
            "text": m.message_content,
            "created_at": m.received_at,
        })

    for n in outbound_msgs:
        thread.append({
            "id": n.id,
            "sender": "store",
            "sender_name": order.store.store_name,
            "text": n.payload,
            "message_type": n.message_type,
            "created_at": n.created_at,
        })

    # Sort chronologically
    thread.sort(key=lambda x: x["created_at"])
    return thread

