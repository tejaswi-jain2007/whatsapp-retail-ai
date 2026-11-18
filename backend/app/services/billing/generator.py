import os
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from app.models.entities import Order, Invoice, Store


class BillingService:
    def __init__(self, pdf_dir: str = "invoices_pdf"):
        self.pdf_dir = pdf_dir
        os.makedirs(self.pdf_dir, exist_ok=True)

    def calculate_order_totals(self, order: Order) -> None:
        """
        Recalculates subtotal, line totals, and grand total using strict Decimal arithmetic.
        """
        subtotal = Decimal("0.00")
        for item in order.items:
            item.total_price = (item.quantity * item.unit_price).quantize(Decimal("0.01"))
            subtotal += item.total_price

        order.subtotal = subtotal
        order.grand_total = (order.subtotal - order.discount + order.tax).quantize(Decimal("0.01"))

    def generate_invoice(
        self,
        db: Session,
        order: Order,
        payment_status: str = "PENDING",
        discount: Optional[Decimal] = None,
        tax: Optional[Decimal] = None,
    ) -> Invoice:
        """
        Creates or updates an invoice for an order and renders a ReportLab PDF.
        """
        if discount is not None:
            order.discount = discount
        if tax is not None:
            order.tax = tax

        self.calculate_order_totals(order)

        # Check if invoice already exists
        invoice = db.query(Invoice).filter(Invoice.order_id == order.id).first()
        if not invoice:
            inv_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{order.order_number}"
            invoice = Invoice(
                order_id=order.id,
                invoice_number=inv_number,
                subtotal=order.subtotal,
                discount=order.discount,
                tax=order.tax,
                total_amount=order.grand_total,
                payment_status=payment_status,
                created_at=datetime.now(timezone.utc),
            )
            db.add(invoice)
        else:
            invoice.subtotal = order.subtotal
            invoice.discount = order.discount
            invoice.tax = order.tax
            invoice.total_amount = order.grand_total
            invoice.payment_status = payment_status

        db.commit()
        db.refresh(invoice)

        # Generate PDF file
        pdf_filename = f"{invoice.invoice_number}.pdf"
        pdf_path = os.path.join(self.pdf_dir, pdf_filename)
        self._generate_pdf_file(order, invoice, pdf_path)

        invoice.pdf_url = f"/api/v1/billing/{invoice.id}/pdf"
        db.commit()
        db.refresh(invoice)
        return invoice

    def _generate_pdf_file(self, order: Order, invoice: Invoice, file_path: str):
        c = canvas.Canvas(file_path, pagesize=letter)
        width, height = letter

        # Header - Store Details
        c.setFont("Helvetica-Bold", 18)
        store_name = order.store.store_name if order.store else "Kirana Retail Store"
        c.drawString(50, height - 50, store_name)

        c.setFont("Helvetica", 10)
        store_address = order.store.address if order.store and order.store.address else "Local Store"
        store_phone = order.store.phone if order.store else ""
        c.drawString(50, height - 68, store_address)
        c.drawString(50, height - 82, f"Phone: {store_phone}")

        # Invoice Metadata
        c.setFont("Helvetica-Bold", 12)
        c.drawRightString(width - 50, height - 50, "RETAIL INVOICE")
        c.setFont("Helvetica", 10)
        c.drawRightString(width - 50, height - 68, f"Invoice #: {invoice.invoice_number}")
        c.drawRightString(width - 50, height - 82, f"Date: {invoice.created_at.strftime('%d-%b-%Y %H:%M')}")
        c.drawRightString(width - 50, height - 96, f"Order #: {order.order_number}")

        # Divider
        c.setStrokeColor(colors.gray)
        c.setLineWidth(1)
        c.line(50, height - 110, width - 50, height - 110)

        # Customer Details
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, height - 130, "Customer Info:")
        c.setFont("Helvetica", 10)
        cust_name = order.customer.name or "WhatsApp Customer"
        cust_phone = order.customer.phone
        c.drawString(140, height - 130, f"{cust_name} ({cust_phone})")

        # Table Header
        y = height - 165
        c.setFillColor(colors.whitesmoke)
        c.rect(50, y - 5, width - 100, 20, fill=True, stroke=False)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(60, y, "Item Description")
        c.drawString(280, y, "Qty")
        c.drawString(350, y, "Unit")
        c.drawString(420, y, "Price (₹)")
        c.drawRightString(width - 60, y, "Total (₹)")

        # Table Rows
        y -= 20
        c.setFont("Helvetica", 9)
        for item in order.items:
            c.drawString(60, y, item.product_name_snapshot[:35])
            c.drawString(280, y, f"{item.quantity:g}")
            c.drawString(350, y, item.unit)
            c.drawString(420, y, f"{item.unit_price:.2f}")
            c.drawRightString(width - 60, y, f"{item.total_price:.2f}")
            y -= 18

        # Totals section
        y -= 10
        c.line(50, y, width - 50, y)
        y -= 20
        c.setFont("Helvetica", 10)
        c.drawRightString(width - 150, y, "Subtotal:")
        c.drawRightString(width - 60, y, f"₹ {order.subtotal:.2f}")

        if order.discount > 0:
            y -= 16
            c.drawRightString(width - 150, y, "Discount:")
            c.drawRightString(width - 60, y, f"- ₹ {order.discount:.2f}")

        if order.tax > 0:
            y -= 16
            c.drawRightString(width - 150, y, "Tax:")
            c.drawRightString(width - 60, y, f"+ ₹ {order.tax:.2f}")

        y -= 20
        c.setFont("Helvetica-Bold", 12)
        c.drawRightString(width - 150, y, "Grand Total:")
        c.drawRightString(width - 60, y, f"₹ {order.grand_total:.2f}")

        y -= 20
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(50, y, f"Payment Status: {invoice.payment_status}")
        y -= 30
        c.setFont("Helvetica-Oblique", 9)
        c.drawCentredString(width / 2.0, y, "Thank you for shopping locally with us!")

        c.save()


billing_service = BillingService()

