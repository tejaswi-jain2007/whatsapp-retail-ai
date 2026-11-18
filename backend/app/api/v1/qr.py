from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import Order, User
from app.schemas.qr import QrGenerateResponse, QrVerifyRequest, QrVerifyResponse
from app.api.deps import get_current_user, verify_store_access
from app.services.qr.service import qr_service

router = APIRouter(prefix="/qr", tags=["QR Pickup Verification"])


@router.post("/{order_id}/generate", response_model=QrGenerateResponse)
def generate_order_qr(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    raw_token, qr_data_url, qr_entry = qr_service.generate_pickup_token(db, order)
    return QrGenerateResponse(
        order_id=order.id,
        order_number=order.order_number,
        token=raw_token,
        qr_data_url=qr_data_url,
        expires_at=qr_entry.expires_at,
    )


@router.post("/verify", response_model=QrVerifyResponse)
def verify_pickup_qr(
    data: QrVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_store_access(data.store_id, current_user, db)

    success, message, order = qr_service.verify_and_collect_order(
        db=db,
        raw_token=data.token,
        store_id=data.store_id,
        verified_by_user_id=current_user.id,
    )

    if not success or not order:
        return QrVerifyResponse(
            success=False,
            message=message,
        )

    return QrVerifyResponse(
        success=True,
        message=message,
        order_id=order.id,
        order_number=order.order_number,
        customer_phone=order.customer.phone if order.customer else None,
        grand_total=f"₹{order.grand_total:.2f}",
        status=order.status,
    )

