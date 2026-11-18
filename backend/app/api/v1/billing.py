import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import Order, Invoice, User
from app.schemas.billing import InvoiceResponse, GenerateInvoiceRequest
from app.api.deps import get_current_user, verify_store_access
from app.services.billing.generator import billing_service

router = APIRouter(prefix="/billing", tags=["Billing & Invoices"])


@router.post("/{order_id}/generate", response_model=InvoiceResponse)
def generate_order_invoice(
    order_id: str,
    data: GenerateInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    verify_store_access(order.store_id, current_user, db)

    invoice = billing_service.generate_invoice(
        db=db,
        order=order,
        payment_status=data.payment_status or "PENDING",
        discount=data.discount,
        tax=data.tax,
    )
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pdf_filename = f"{invoice.invoice_number}.pdf"
    pdf_path = os.path.join(billing_service.pdf_dir, pdf_filename)

    if not os.path.exists(pdf_path):
        # Regenerate if file missing
        order = db.query(Order).filter(Order.id == invoice.order_id).first()
        if order:
            billing_service._generate_pdf_file(order, invoice, pdf_path)
        else:
            raise HTTPException(status_code=404, detail="Invoice PDF file not found")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=pdf_filename,
    )

