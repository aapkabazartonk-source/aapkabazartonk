import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type InvoiceParty = {
  businessName?: string;
  legalName?: string;
  gstin?: string;
  isGstRegistered?: boolean;
  address?: string;
  phone?: string;
  storeName?: string;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  placeOfSupply?: string;
  pricesIncludeGst?: boolean;
};

type InvoiceItem = {
  productName: string;
  sku?: string;
  hsn?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  finalAmount: number;
};

type InvoicePayment = {
  paymentMethod: string;
  amount: number;
  tenderedAmount?: number;
  changeGiven?: number;
  referenceNumber?: string;
  status?: string;
  verification?: string;
};

export type InvoicePdfSource = {
  invoiceNumber: string;
  saleNumber?: string;
  invoiceType: string;
  createdAt: string | Date;
  supplyType?: string;
  subtotal: number;
  itemDiscount: number;
  billDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  changeGiven: number;
  paymentStatus: string;
  items: InvoiceItem[];
  invoiceSnapshot?: InvoiceParty;
  payments?: InvoicePayment[];
};

function money(value: number) {
  const formatted = Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${formatted}`;
}

function methodLabel(method: string) {
  if (method === "BANK_TRANSFER") return "Bank transfer";
  if (method === "CREDIT") return "Udhaar";
  if (method === "UPI") return "UPI (manual)";
  return method.charAt(0) + method.slice(1).toLowerCase();
}

export async function renderInvoicePdf(sale: InvoicePdfSource) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.15, 0.17, 0.15);
  const muted = rgb(0.4, 0.44, 0.4);
  const line = rgb(0.85, 0.88, 0.84);
  const green = rgb(0.07, 0.37, 0.33);

  const snap = sale.invoiceSnapshot ?? {};
  let y = 800;

  const draw = (
    text: string,
    x: number,
    size = 10,
    weight: "regular" | "bold" = "regular",
    color = ink,
  ) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: weight === "bold" ? bold : font,
      color,
    });
  };

  draw(snap.storeName || snap.businessName || "Store", 40, 16, "bold", green);
  y -= 18;
  if (snap.legalName) {
    draw(snap.legalName, 40, 10, "regular", muted);
    y -= 14;
  }
  if (snap.address) {
    draw(snap.address.slice(0, 110), 40, 9, "regular", muted);
    y -= 12;
  }
  if (snap.phone) {
    draw(snap.phone, 40, 9, "regular", muted);
    y -= 12;
  }
  if (snap.isGstRegistered && snap.gstin) {
    draw(`GSTIN ${snap.gstin}`, 40, 9, "bold");
    y -= 14;
  }

  const title = sale.invoiceType === "TAX_INVOICE" ? "TAX INVOICE" : "BILL OF SUPPLY";
  page.drawText(title, {
    x: 400,
    y: 800,
    size: 14,
    font: bold,
    color: green,
  });
  page.drawText(sale.invoiceNumber, {
    x: 400,
    y: 782,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText(new Date(sale.createdAt).toLocaleString("en-IN"), {
    x: 400,
    y: 768,
    size: 9,
    font,
    color: muted,
  });

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: line });
  y -= 22;
  draw("Bill to", 40, 9, "bold", muted);
  y -= 14;
  draw(snap.customerName || "Walk-in customer", 40, 11, "bold");
  y -= 14;
  if (snap.customerPhone) {
    draw(snap.customerPhone, 40, 9, "regular", muted);
    y -= 12;
  }
  if (snap.customerGstin) {
    draw(`GSTIN ${snap.customerGstin}`, 40, 9);
    y -= 12;
  }
  if (snap.placeOfSupply) {
    draw(`Place of supply: ${snap.placeOfSupply}`, 40, 9, "regular", muted);
    y -= 12;
  }
  if (snap.pricesIncludeGst && snap.isGstRegistered) {
    draw("Prices are GST inclusive", 40, 9, "regular", muted);
    y -= 12;
  }

  y -= 8;
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 20, color: rgb(0.91, 0.96, 0.93) });
  const headers = ["Item", "HSN", "Qty", "Price", "Disc.", "Tax", "Amount"];
  const cols = [44, 230, 280, 320, 390, 450, 510];
  headers.forEach((header, index) => {
    page.drawText(header, { x: cols[index], y: y, size: 8, font: bold, color: green });
  });
  y -= 22;

  for (const item of sale.items) {
    if (y < 120) break;
    const name = item.productName.length > 32 ? `${item.productName.slice(0, 31)}…` : item.productName;
    page.drawText(name, { x: cols[0], y, size: 9, font, color: ink });
    page.drawText((item.hsn || "—").slice(0, 8), { x: cols[1], y, size: 8, font, color: muted });
    page.drawText(String(item.quantity), { x: cols[2], y, size: 9, font, color: ink });
    page.drawText(money(item.unitPrice), { x: cols[3], y, size: 8, font, color: ink });
    page.drawText(money(item.discount ?? 0), { x: cols[4], y, size: 8, font, color: ink });
    page.drawText(`${item.taxRate ?? 0}%`, { x: cols[5], y, size: 8, font, color: ink });
    page.drawText(money(item.finalAmount), { x: cols[6], y, size: 9, font: bold, color: ink });
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: 320, y }, end: { x: 555, y }, thickness: 1, color: line });
  y -= 16;

  const rows: [string, string][] = [
    ["Subtotal", money(sale.subtotal)],
    ["Item discount", money(sale.itemDiscount)],
    ["Bill discount", money(sale.billDiscount)],
    ["Taxable value", money(sale.taxableAmount)],
  ];
  if (sale.cgst) rows.push(["CGST", money(sale.cgst)]);
  if (sale.sgst) rows.push(["SGST", money(sale.sgst)]);
  if (sale.igst) rows.push(["IGST", money(sale.igst)]);
  rows.push(["Total tax", money(sale.totalTax)]);
  rows.push(["Grand total", money(sale.grandTotal)]);
  rows.push(["Amount received", money(sale.amountPaid)]);
  rows.push(["Balance due", money(sale.balanceDue)]);
  if (sale.changeGiven) rows.push(["Change returned", money(sale.changeGiven)]);

  for (const [label, value] of rows) {
    const strong = label === "Grand total";
    page.drawText(label, {
      x: 340,
      y,
      size: strong ? 11 : 9,
      font: strong ? bold : font,
      color: ink,
    });
    page.drawText(value, {
      x: 470,
      y,
      size: strong ? 11 : 9,
      font: bold,
      color: ink,
    });
    y -= strong ? 18 : 14;
  }

  y -= 8;
  page.drawText("Payments", { x: 40, y, size: 10, font: bold, color: green });
  y -= 14;
  const payments = sale.payments ?? [];
  if (payments.length === 0) {
    page.drawText("No payment recorded", { x: 40, y, size: 9, font, color: muted });
    y -= 14;
  }
  for (const payment of payments) {
    const manual =
      payment.verification === "MANUAL" || payment.status === "MANUALLY_CONFIRMED"
        ? " · manually confirmed"
        : "";
    const reference = payment.referenceNumber ? ` · ${payment.referenceNumber}` : "";
    page.drawText(
      `${methodLabel(payment.paymentMethod)} ${money(payment.amount)}${reference}${manual}`,
      { x: 40, y, size: 9, font, color: ink },
    );
    y -= 13;
  }

  y -= 16;
  page.drawText("This invoice is a snapshot of the sale. Later product or tax changes do not alter it.", {
    x: 40,
    y: Math.max(y, 40),
    size: 8,
    font,
    color: muted,
  });

  return pdf.save();
}
