import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { InvoiceDocument } from "../src/components/billing/invoice-document.tsx";
import { renderInvoicePdf } from "../src/lib/invoice-pdf.ts";
import type { PaymentRecord, SaleRecord } from "../src/types/billing.ts";

const sale: SaleRecord = {
  _id: "sale1",
  saleNumber: "SAL-20261103-0001",
  invoiceNumber: "INV-20261103-0001",
  invoiceType: "TAX_INVOICE",
  supplyType: "INTRA",
  paymentStatus: "PAID",
  saleStatus: "COMPLETED",
  pricesIncludeGst: false,
  notes: "",
  subtotal: 100,
  itemDiscount: 0,
  billDiscount: 0,
  taxableAmount: 100,
  cgst: 9,
  sgst: 9,
  igst: 0,
  totalTax: 18,
  grandTotal: 118,
  amountPaid: 118,
  balanceDue: 0,
  changeGiven: 0,
  createdAt: "2026-11-03T08:00:00.000Z",
  items: [
    {
      productName: "Basmati Rice",
      sku: "RICE",
      barcode: "8901001",
      quantity: 1,
      unit: "kg",
      unitPrice: 100,
      discount: 0,
      billDiscountShare: 0,
      hsn: "1006",
      taxRate: 18,
      taxableAmount: 100,
      cgst: 9,
      sgst: 9,
      igst: 0,
      taxAmount: 18,
      finalAmount: 118,
    },
  ],
  invoiceSnapshot: {
    businessName: "Aapka Bazar",
    legalName: "Aapka Bazar Stores",
    gstin: "27AAPFU0939F1ZV",
    isGstRegistered: true,
    stateCode: "27",
    stateName: "Maharashtra",
    address: "12 Market Road, Pune",
    phone: "9999999999",
    storeName: "Main store",
    storeCode: "MAIN",
    pricesIncludeGst: false,
    customerName: "Walk-in customer",
    customerPhone: "",
    customerGstin: "",
    customerAddress: "",
    customerStateCode: "",
    customerStateName: "",
    supplyType: "INTRA",
    placeOfSupply: "Maharashtra",
  },
};

const payments: PaymentRecord[] = [
  {
    _id: "pay1",
    paymentMethod: "UPI",
    amount: 118,
    tenderedAmount: 118,
    changeGiven: 0,
    referenceNumber: "UTR1",
    status: "MANUALLY_CONFIRMED",
    verification: "MANUAL",
  },
];

describe("invoice preview", () => {
  it("renders a 58mm thermal receipt with the tax snapshot", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceDocument, { sale, payments, format: "58" }),
    );
    assert.match(html, /58mm/);
    assert.match(html, /Tax invoice/);
    assert.match(html, /INV-20261103-0001/);
    assert.match(html, /Main store/);
    assert.match(html, /27AAPFU0939F1ZV/);
    assert.match(html, /HSN 1006/);
    assert.match(html, /Basmati Rice/);
    assert.match(html, /manually confirmed/i);
    assert.doesNotMatch(html, /gateway verified/i);
  });

  it("renders an 80mm and A4 layout from the same snapshot", () => {
    const thermal = renderToStaticMarkup(
      createElement(InvoiceDocument, { sale, payments, format: "80" }),
    );
    const a4 = renderToStaticMarkup(
      createElement(InvoiceDocument, { sale, payments, format: "a4" }),
    );
    assert.match(thermal, /80mm/);
    assert.match(a4, /210mm/);
    assert.match(a4, /CGST/);
    assert.match(a4, /SGST/);
  });

  it("builds an A4 PDF", async () => {
    const bytes = await renderInvoicePdf({ ...sale, payments });
    assert.ok(bytes.byteLength > 500);
    assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), "%PDF");
  });
});
