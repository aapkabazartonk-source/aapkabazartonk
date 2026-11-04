import { formatCurrency } from "@/lib/utils";
import {
  paymentRecordLabel,
  type PaymentRecord,
  type SaleRecord,
} from "@/types/billing";

export type InvoicePaper = "58" | "80" | "a4";

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InvoiceDocument({
  sale,
  payments,
  format,
}: {
  sale: SaleRecord;
  payments: PaymentRecord[];
  format: InvoicePaper;
}) {
  const snap = sale.invoiceSnapshot;
  const thermal = format !== "a4";
  const title = sale.invoiceType === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply";

  return (
    <article
      id="invoice-print"
      className={
        thermal
          ? "mx-auto bg-white px-2 py-3 text-black"
          : "mx-auto bg-white px-8 py-8 text-black"
      }
      style={{ width: format === "58" ? "58mm" : format === "80" ? "80mm" : "210mm", maxWidth: "100%" }}
    >
      <header className={thermal ? "text-center" : "flex items-start justify-between gap-6 border-b border-neutral-300 pb-4"}>
        <div className={thermal ? "" : "min-w-0"}>
          <p className={thermal ? "text-sm font-semibold" : "text-xl font-semibold text-[#075E54]"}>
            {snap?.storeName || snap?.businessName || "Store"}
          </p>
          {snap?.legalName ? (
            <p className="text-[11px] text-neutral-600">{snap.legalName}</p>
          ) : null}
          {snap?.address ? (
            <p className="mt-1 text-[11px] leading-snug text-neutral-700">{snap.address}</p>
          ) : null}
          {snap?.phone ? <p className="text-[11px]">{snap.phone}</p> : null}
          {snap?.isGstRegistered && snap.gstin ? (
            <p className="mt-1 text-[11px] font-medium">GSTIN {snap.gstin}</p>
          ) : null}
        </div>
        <div className={thermal ? "mt-2" : "text-right"}>
          <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
          <p className="text-sm font-semibold">{sale.invoiceNumber}</p>
          <p className="text-[11px] text-neutral-600">{formatWhen(sale.createdAt)}</p>
          {sale.saleNumber ? (
            <p className="text-[11px] text-neutral-600">Sale {sale.saleNumber}</p>
          ) : null}
        </div>
      </header>

      <section className={thermal ? "mt-3 border-t border-dashed border-neutral-400 pt-2 text-[11px]" : "mt-4 text-sm"}>
        <p className="font-medium">{snap?.customerName || "Walk-in customer"}</p>
        {snap?.customerPhone ? <p>{snap.customerPhone}</p> : null}
        {snap?.customerGstin ? <p>GSTIN {snap.customerGstin}</p> : null}
        {snap?.customerAddress ? <p>{snap.customerAddress}</p> : null}
        {snap?.placeOfSupply ? <p>Place of supply: {snap.placeOfSupply}</p> : null}
        {sale.pricesIncludeGst && snap?.isGstRegistered ? (
          <p className="mt-1 text-[11px]">Prices include GST</p>
        ) : null}
      </section>

      {thermal ? (
        <div className="mt-3 border-t border-dashed border-neutral-400 pt-2 text-[11px]">
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
      ) : (
        <table className="mt-6 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-300 text-[11px] uppercase tracking-wide text-neutral-600">
              <th className="py-2 pr-2 font-medium">Item</th>
              <th className="py-2 pr-2 font-medium">HSN</th>
              <th className="py-2 pr-2 font-medium">Qty</th>
              <th className="py-2 pr-2 font-medium">Price</th>
              <th className="py-2 pr-2 font-medium">Discount</th>
              <th className="py-2 pr-2 font-medium">Taxable</th>
              <th className="py-2 pr-2 font-medium">GST %</th>
              <th className="py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item, index) => (
              <tr key={`${item.sku}-${index}`} className="border-b border-neutral-200">
                <td className="py-2 pr-2">
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-[11px] text-neutral-500">{item.sku}</p>
                </td>
                <td className="py-2 pr-2">{item.hsn || "—"}</td>
                <td className="py-2 pr-2">
                  {item.quantity} {item.unit}
                </td>
                <td className="py-2 pr-2">{formatCurrency(item.unitPrice)}</td>
                <td className="py-2 pr-2">{formatCurrency(item.discount)}</td>
                <td className="py-2 pr-2">{formatCurrency(item.taxableAmount)}</td>
                <td className="py-2 pr-2">{item.taxRate}</td>
                <td className="py-2">{formatCurrency(item.finalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dl className={thermal ? "mt-2 space-y-1 border-t border-dashed border-neutral-400 pt-2 text-[11px]" : "ml-auto mt-4 w-72 space-y-1 text-sm"}>
        <Row label="Subtotal" value={formatCurrency(sale.subtotal)} />
        <Row label="Item discount" value={formatCurrency(sale.itemDiscount)} />
        <Row label="Bill discount" value={formatCurrency(sale.billDiscount)} />
        <Row label="Taxable value" value={formatCurrency(sale.taxableAmount)} />
        {sale.cgst > 0 ? <Row label="CGST" value={formatCurrency(sale.cgst)} /> : null}
        {sale.sgst > 0 ? <Row label="SGST" value={formatCurrency(sale.sgst)} /> : null}
        {sale.igst > 0 ? <Row label="IGST" value={formatCurrency(sale.igst)} /> : null}
        <Row label="Total tax" value={formatCurrency(sale.totalTax)} />
        <div className="flex items-center justify-between border-t border-neutral-300 pt-1 font-semibold">
          <dt>Grand total</dt>
          <dd>{formatCurrency(sale.grandTotal)}</dd>
        </div>
        <Row label="Amount received" value={formatCurrency(sale.amountPaid)} />
        <Row label="Balance due" value={formatCurrency(sale.balanceDue)} />
        {sale.changeGiven > 0 ? (
          <Row label="Change returned" value={formatCurrency(sale.changeGiven)} />
        ) : null}
      </dl>

      <section className={thermal ? "mt-2 border-t border-dashed border-neutral-400 pt-2 text-[11px]" : "mt-4 text-sm"}>
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
        <p className="mt-3 text-[11px] text-neutral-600">Note: {sale.notes}</p>
      ) : null}
      <p className="mt-3 text-[10px] text-neutral-500">
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
