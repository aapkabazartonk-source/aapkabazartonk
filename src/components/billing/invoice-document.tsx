import { formatCurrency } from "@/lib/utils";
import {
  paymentRecordLabel,
  type PaymentRecord,
  type SaleRecord,
} from "@/types/billing";

export type InvoicePaper = "58mm" | "80mm" | "A4" | "6x4";

const PAPER_STYLES: Record<
  InvoicePaper,
  { width: string; minHeight: string; className: string }
> = {
  "58mm": { width: "58mm", minHeight: "auto", className: "text-[9px]" },
  "80mm": { width: "80mm", minHeight: "auto", className: "text-[10px]" },
  A4: { width: "210mm", minHeight: "297mm", className: "text-sm" },
  "6x4": { width: "4in", minHeight: "6in", className: "text-[10px]" },
};

export const INVOICE_PAPER: InvoicePaper = "80mm";
export const INVOICE_WIDTH = "80mm";
export const INVOICE_HEIGHT = "auto";

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function resolvePaper(value?: string | null): InvoicePaper {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "58mm" || normalized === "58") return "58mm";
  if (normalized === "80mm" || normalized === "80") return "80mm";
  if (normalized === "a4") return "A4";
  if (normalized === "6x4") return "6x4";
  return "80mm";
}

export function InvoiceDocument({
  sale,
  payments,
  format,
}: {
  sale: SaleRecord;
  payments: PaymentRecord[];
  format?: InvoicePaper;
}) {
  const snap = sale.invoiceSnapshot;
  const paper = resolvePaper(format ?? snap?.paperSize);
  const style = PAPER_STYLES[paper];
  const title = sale.invoiceType === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply";
  const showGstin = snap?.showGstin !== false;
  const showLogo = snap?.showLogo !== false;
  const showAddress = snap?.showAddress !== false;

  return (
    <article
      id="invoice-print"
      className={`mx-auto bg-white px-3 py-3 text-black ${style.className}`}
      style={{ width: style.width, maxWidth: "100%", minHeight: style.minHeight }}
      data-paper={paper}
    >
      <header className="text-center">
        {showLogo && snap?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snap.logoUrl}
            alt=""
            className="mx-auto mb-2 h-12 w-auto object-contain"
          />
        ) : null}
        <p className="text-sm font-semibold leading-tight">
          {snap?.storeName || snap?.businessName || "Store"}
        </p>
        {snap?.legalName ? (
          <p className="text-[10px] text-neutral-600">{snap.legalName}</p>
        ) : null}
        {showAddress && snap?.address ? (
          <p className="mt-1 text-[10px] leading-snug text-neutral-700">{snap.address}</p>
        ) : null}
        {snap?.phone ? <p className="text-[10px]">{snap.phone}</p> : null}
        {showGstin && snap?.isGstRegistered && snap.gstin ? (
          <p className="mt-1 text-[10px] font-medium">GSTIN {snap.gstin}</p>
        ) : null}
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide">{title}</p>
          <p className="text-sm font-semibold">{sale.invoiceNumber}</p>
          <p className="text-[10px] text-neutral-600">{formatWhen(sale.createdAt)}</p>
          {sale.saleNumber ? (
            <p className="text-[10px] text-neutral-600">Sale {sale.saleNumber}</p>
          ) : null}
        </div>
      </header>

      <section className="mt-3 border-t border-dashed border-neutral-400 pt-2 text-[10px]">
        <p className="font-medium">{snap?.customerName || "Walk-in customer"}</p>
        {snap?.customerPhone ? <p>{snap.customerPhone}</p> : null}
        {snap?.customerGstin ? <p>GSTIN {snap.customerGstin}</p> : null}
        {snap?.customerAddress ? <p>{snap.customerAddress}</p> : null}
        {snap?.placeOfSupply ? <p>Place of supply: {snap.placeOfSupply}</p> : null}
        {sale.pricesIncludeGst && snap?.isGstRegistered ? (
          <p className="mt-1">Prices include GST</p>
        ) : null}
      </section>

      <div className="mt-3 border-t border-dashed border-neutral-400 pt-2 text-[10px]">
        {sale.items?.map((item, index) => (
          <div key={`${item.sku}-${index}`} className="mb-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-tight">{item.productName}</p>
              <p className="shrink-0">{formatCurrency(item.finalAmount)}</p>
            </div>
            <p className="text-neutral-600">
              {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
              {item.hsn ? ` · HSN ${item.hsn}` : ""}
              {item.taxRate ? ` · GST ${item.taxRate}%` : ""}
            </p>
            {item.discount > 0 ? (
              <p className="text-neutral-600">Discount {formatCurrency(item.discount)}</p>
            ) : null}
          </div>
        ))}
      </div>

      <dl className="mt-2 space-y-1 border-t border-dashed border-neutral-400 pt-2 text-[10px]">
        <Row label="Subtotal" value={formatCurrency(sale.subtotal)} />
        <Row label="Item discount" value={formatCurrency(sale.itemDiscount)} />
        <Row label="Bill discount" value={formatCurrency(sale.billDiscount)} />
        <Row label="Taxable value" value={formatCurrency(sale.taxableAmount)} />
        {sale.cgst > 0 ? <Row label="CGST" value={formatCurrency(sale.cgst)} /> : null}
        {sale.sgst > 0 ? <Row label="SGST" value={formatCurrency(sale.sgst)} /> : null}
        {sale.igst > 0 ? <Row label="IGST" value={formatCurrency(sale.igst)} /> : null}
        <Row label="Total tax" value={formatCurrency(sale.totalTax)} />
        <div className="flex items-center justify-between border-t border-neutral-300 pt-1 text-[11px] font-semibold">
          <dt>Grand total</dt>
          <dd>{formatCurrency(sale.grandTotal)}</dd>
        </div>
        <Row label="Amount received" value={formatCurrency(sale.amountPaid)} />
        <Row label="Balance due" value={formatCurrency(sale.balanceDue)} />
        {sale.changeGiven > 0 ? (
          <Row label="Change returned" value={formatCurrency(sale.changeGiven)} />
        ) : null}
      </dl>

      <section className="mt-2 border-t border-dashed border-neutral-400 pt-2 text-[10px]">
        <p className="font-medium">Payments</p>
        {payments.length === 0 ? <p>No payment recorded</p> : null}
        {payments.map((payment) => (
          <p key={payment._id || `${payment.paymentMethod}-${payment.amount}`}>
            {paymentRecordLabel(payment)} · {formatCurrency(payment.amount)}
            {payment.referenceNumber ? ` · ${payment.referenceNumber}` : ""}
            {payment.paymentMethod === "CASH" && payment.changeGiven > 0
              ? ` · tendered ${formatCurrency(payment.tenderedAmount)}`
              : ""}
          </p>
        ))}
      </section>

      {sale.notes ? (
        <p className="mt-3 text-[10px] text-neutral-600">Note: {sale.notes}</p>
      ) : null}

      {snap?.termsAndConditions ? (
        <p className="mt-3 text-[9px] text-neutral-600 whitespace-pre-wrap">
          {snap.termsAndConditions}
        </p>
      ) : null}
      {snap?.footerNote ? (
        <p className="mt-2 text-[9px] text-neutral-600">{snap.footerNote}</p>
      ) : null}
      {snap?.thankYouMessage ? (
        <p className="mt-2 text-center text-[10px] font-medium">{snap.thankYouMessage}</p>
      ) : null}

      <p className="mt-3 text-[9px] text-neutral-500">
        Saved with this sale. Later product or tax changes do not alter this invoice.
      </p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-600">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
