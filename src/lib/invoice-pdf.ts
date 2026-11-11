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

/** 6×4 cash memo: 4in × 6in in PDF points. */
const PAGE_WIDTH = 4 * 72;
const PAGE_HEIGHT = 6 * 72;
const MARGIN = 18;

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

function clip(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export async function renderInvoicePdf(sale: InvoicePdfSource) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.15, 0.17, 0.15);
  const muted = rgb(0.4, 0.44, 0.4);
  const green = rgb(0.07, 0.37, 0.33);

  const snap = sale.invoiceSnapshot ?? {};
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  const draw = (
    text: string,
    x: number,
    size = 8,
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

  const center = (text: string, size = 8, weight: "regular" | "bold" = "regular", color = ink) => {
    const used = weight === "bold" ? bold : font;
    const width = used.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: Math.max(MARGIN, (PAGE_WIDTH - width) / 2),
      y,
      size,
      font: used,
      color,
    });
  };

  const store = clip(snap.storeName || snap.businessName || "Store", 36);
  center(store, 11, "bold", green);
  y -= 13;
  if (snap.legalName) {
    center(clip(snap.legalName, 42), 7, "regular", muted);
    y -= 10;
  }
  if (snap.address) {
    center(clip(snap.address, 48), 7, "regular", muted);
    y -= 10;
  }
  if (snap.phone) {
    center(snap.phone, 7, "regular", muted);
    y -= 10;
  }
  if (snap.isGstRegistered && snap.gstin) {
    center(`GSTIN ${snap.gstin}`, 7, "bold");
    y -= 11;
  }

  const title = sale.invoiceType === "TAX_INVOICE" ? "TAX INVOICE" : "BILL OF SUPPLY";
  center(title, 8, "bold", green);
  y -= 11;
  center(sale.invoiceNumber, 9, "bold");
  y -= 10;
  center(new Date(sale.createdAt).toLocaleString("en-IN"), 7, "regular", muted);
  y -= 12;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: muted,
  });
  y -= 12;

  draw(snap.customerName || "Walk-in customer", MARGIN, 8, "bold");
  y -= 11;
  if (snap.customerPhone) {
    draw(snap.customerPhone, MARGIN, 7, "regular", muted);
    y -= 10;
  }
  if (snap.placeOfSupply) {
    draw(clip(`Place of supply: ${snap.placeOfSupply}`, 46), MARGIN, 7, "regular", muted);
    y -= 10;
  }
  if (snap.pricesIncludeGst && snap.isGstRegistered) {
    draw("Prices include GST", MARGIN, 7, "regular", muted);
    y -= 10;
  }

  y -= 2;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: muted,
  });
  y -= 12;

  for (const item of sale.items) {
    if (y < 70) break;
    const name = clip(item.productName, 28);
    const amount = money(item.finalAmount);
    const amountWidth = bold.widthOfTextAtSize(amount, 8);
    draw(name, MARGIN, 8, "bold");
    page.drawText(amount, {
      x: PAGE_WIDTH - MARGIN - amountWidth,
      y,
      size: 8,
      font: bold,
      color: ink,
    });
    y -= 10;
    draw(
      clip(
        `${item.quantity} ${item.unit || ""} × ${money(item.unitPrice)}${item.hsn ? ` · HSN ${item.hsn}` : ""}${item.taxRate ? ` · GST ${item.taxRate}%` : ""}`,
        52,
      ),
      MARGIN,
      7,
      "regular",
      muted,
    );
    y -= 11;
    if ((item.discount ?? 0) > 0) {
      draw(`Discount ${money(item.discount ?? 0)}`, MARGIN, 7, "regular", muted);
      y -= 10;
    }
  }

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: muted,
  });
  y -= 12;

  const rows: [string, string, boolean?][] = [
    ["Subtotal", money(sale.subtotal)],
    ["Item discount", money(sale.itemDiscount)],
    ["Bill discount", money(sale.billDiscount)],
    ["Taxable value", money(sale.taxableAmount)],
  ];
  if (sale.cgst) rows.push(["CGST", money(sale.cgst)]);
  if (sale.sgst) rows.push(["SGST", money(sale.sgst)]);
  if (sale.igst) rows.push(["IGST", money(sale.igst)]);
  rows.push(["Total tax", money(sale.totalTax)]);
  rows.push(["Grand total", money(sale.grandTotal), true]);
  rows.push(["Amount received", money(sale.amountPaid)]);
  rows.push(["Balance due", money(sale.balanceDue)]);
  if (sale.changeGiven) rows.push(["Change returned", money(sale.changeGiven)]);

  for (const [label, value, strong] of rows) {
    if (y < 40) break;
    const size = strong ? 9 : 7;
    const valueWidth = (strong ? bold : font).widthOfTextAtSize(value, size);
    page.drawText(label, {
      x: MARGIN,
      y,
      size,
      font: strong ? bold : font,
      color: ink,
    });
    page.drawText(value, {
      x: PAGE_WIDTH - MARGIN - valueWidth,
      y,
      size,
      font: bold,
      color: ink,
    });
    y -= strong ? 12 : 10;
  }

  y -= 4;
  if (y > 36) {
    draw("Payments", MARGIN, 8, "bold", green);
    y -= 10;
    const payments = sale.payments ?? [];
    if (payments.length === 0) {
      draw("No payment recorded", MARGIN, 7, "regular", muted);
      y -= 10;
    }
    for (const payment of payments) {
      if (y < 28) break;
      const manual =
        payment.verification === "MANUAL" || payment.status === "MANUALLY_CONFIRMED"
          ? " · manual"
          : "";
      const reference = payment.referenceNumber ? ` · ${payment.referenceNumber}` : "";
      draw(
        clip(`${methodLabel(payment.paymentMethod)} ${money(payment.amount)}${reference}${manual}`, 48),
        MARGIN,
        7,
      );
      y -= 10;
    }
  }

  page.drawText("6x4 invoice snapshot", {
    x: MARGIN,
    y: 16,
    size: 6,
    font,
    color: muted,
    maxWidth: contentWidth,
  });

  return pdf.save();
}
