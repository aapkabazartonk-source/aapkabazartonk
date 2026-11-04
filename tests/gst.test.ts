import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateSale } from "../src/lib/gst.ts";
import { toPaise } from "../src/lib/money.ts";
import { settlePayments } from "../src/lib/payment-settlement.ts";
import type { BusinessTaxSettings, CatalogSaleLine } from "../src/lib/gst.ts";

const retail: BusinessTaxSettings = {
  isGstRegistered: true,
  gstin: "27AAPFU0939F1ZV",
  stateCode: "27",
  pricesIncludeGst: false,
};

const inclusive: BusinessTaxSettings = { ...retail, pricesIncludeGst: true };
const unregistered: BusinessTaxSettings = {
  isGstRegistered: false,
  gstin: "",
  stateCode: "",
  pricesIncludeGst: false,
};

function line(overrides: Partial<CatalogSaleLine> = {}): CatalogSaleLine {
  return {
    productId: "p1",
    productName: "Rice",
    sku: "RICE",
    barcode: "8901",
    unit: "piece",
    hsn: "1006",
    quantity: 1,
    unitPrice: 100,
    gstRate: 18,
    itemDiscount: 0,
    ...overrides,
  };
}

describe("GST engine", () => {
  it("calculates exclusive CGST and SGST from the product rate", () => {
    const result = calculateSale({
      settings: retail,
      lines: [line()],
      billDiscount: 0,
    });
    assert.equal(result.invoiceType, "TAX_INVOICE");
    assert.equal(result.supplyType, "INTRA");
    assert.equal(result.totals.taxableAmount, 100);
    assert.equal(result.totals.totalTax, 18);
    assert.equal(result.totals.cgst, 9);
    assert.equal(result.totals.sgst, 9);
    assert.equal(result.totals.igst, 0);
    assert.equal(result.totals.grandTotal, 118);
    assert.equal(result.lines[0].taxRate, 18);
  });

  it("uses IGST for a customer in another state", () => {
    const result = calculateSale({
      settings: retail,
      customerStateCode: "29",
      lines: [line({ gstRate: 5, unitPrice: 200 })],
      billDiscount: 0,
    });
    assert.equal(result.supplyType, "INTER");
    assert.equal(result.totals.igst, 10);
    assert.equal(result.totals.cgst, 0);
    assert.equal(result.totals.sgst, 0);
    assert.equal(result.totals.grandTotal, 210);
  });

  it("extracts tax from GST-inclusive prices", () => {
    const result = calculateSale({
      settings: inclusive,
      lines: [line({ unitPrice: 118 })],
      billDiscount: 0,
    });
    assert.equal(result.totals.taxableAmount, 100);
    assert.equal(result.totals.totalTax, 18);
    assert.equal(result.totals.grandTotal, 118);
    assert.equal(result.lines[0].cgst + result.lines[0].sgst, 18);
  });

  it("does not charge GST for an unregistered business", () => {
    const result = calculateSale({
      settings: unregistered,
      lines: [line({ gstRate: 18, unitPrice: 80 })],
      billDiscount: 0,
    });
    assert.equal(result.invoiceType, "BILL_OF_SUPPLY");
    assert.equal(result.totals.totalTax, 0);
    assert.equal(result.totals.grandTotal, 80);
    assert.equal(result.lines[0].taxRate, 0);
  });

  it("issues a bill of supply when every product rate is zero", () => {
    const result = calculateSale({
      settings: retail,
      lines: [line({ gstRate: 0, hsn: "" })],
      billDiscount: 0,
    });
    assert.equal(result.invoiceType, "BILL_OF_SUPPLY");
    assert.equal(result.totals.totalTax, 0);
    assert.equal(result.totals.grandTotal, 100);
  });

  it("applies item and bill discounts before tax", () => {
    const result = calculateSale({
      settings: retail,
      lines: [
        line({ productId: "a", unitPrice: 100, gstRate: 18, itemDiscount: 10 }),
        line({ productId: "b", productName: "Dal", unitPrice: 50, gstRate: 5 }),
      ],
      billDiscount: 15,
    });
    assert.equal(result.totals.subtotal, 150);
    assert.equal(result.totals.itemDiscount, 10);
    assert.equal(result.totals.billDiscount, 15);
    assert.equal(result.lines[0].billDiscountShare + result.lines[1].billDiscountShare, 15);
    assert.equal(result.lines[0].taxableAmount, 80.36);
    assert.equal(result.lines[0].taxAmount, 14.46);
    assert.equal(result.lines[1].taxableAmount, 44.64);
    assert.equal(result.lines[1].taxAmount, 2.23);
    assert.equal(result.totals.grandTotal, 141.69);
    assert.equal(
      toPaise(result.totals.cgst) +
        toPaise(result.totals.sgst) +
        toPaise(result.totals.igst),
      toPaise(result.totals.totalTax),
    );
  });

  it("rejects a bill discount larger than the net amount", () => {
    assert.throws(
      () =>
        calculateSale({
          settings: unregistered,
          lines: [line({ gstRate: 0 })],
          billDiscount: 101,
        }),
      /Bill discount cannot exceed/,
    );
  });

  it("requires GSTIN and state before a registered business can bill", () => {
    assert.throws(
      () =>
        calculateSale({
          settings: { ...retail, gstin: "" },
          lines: [line({ gstRate: 0 })],
          billDiscount: 0,
        }),
      /GSTIN/,
    );
  });
});

describe("payment settlement", () => {
  it("returns change for cash and records only the applied amount", () => {
    const result = settlePayments(850, [{ method: "CASH", amount: 1000 }], false);
    assert.equal(result.amountPaid, 850);
    assert.equal(result.changeGiven, 150);
    assert.equal(result.balanceDue, 0);
    assert.equal(result.paymentStatus, "PAID");
    assert.equal(result.payments[0].amount, 850);
    assert.equal(result.payments[0].tenderedAmount, 1000);
    assert.equal(result.payments[0].status, "CONFIRMED");
  });

  it("records UPI as manually confirmed", () => {
    const result = settlePayments(
      500,
      [{ method: "UPI", amount: 500, referenceNumber: "UTR123" }],
      false,
    );
    assert.equal(result.paymentStatus, "PAID");
    assert.equal(result.payments[0].status, "MANUALLY_CONFIRMED");
    assert.equal(result.payments[0].verification, "MANUAL");
    assert.equal(result.payments[0].referenceNumber, "UTR123");
    assert.notEqual(result.payments[0].verification, "VERIFIED");
  });

  it("records a card payment without a gateway status", () => {
    const result = settlePayments(250, [{ method: "CARD", amount: 250 }], false);
    assert.equal(result.payments[0].status, "CONFIRMED");
    assert.equal(result.payments[0].verification, "MANUAL");
  });

  it("splits cash and UPI and returns the extra cash", () => {
    const result = settlePayments(
      100,
      [
        { method: "UPI", amount: 40 },
        { method: "CASH", amount: 80 },
      ],
      false,
    );
    assert.equal(result.amountPaid, 100);
    assert.equal(result.changeGiven, 20);
    assert.equal(result.balanceDue, 0);
    assert.equal(result.payments[1].amount, 60);
  });

  it("keeps a partial balance as udhaar", () => {
    const result = settlePayments(100, [{ method: "CASH", amount: 30 }], true);
    assert.equal(result.amountPaid, 30);
    assert.equal(result.balanceDue, 70);
    assert.equal(result.paymentStatus, "PARTIAL");
    assert.equal(result.payments[1].method, "CREDIT");
    assert.equal(result.payments[1].amount, 70);
  });

  it("records a full credit sale as unpaid", () => {
    const result = settlePayments(100, [], true);
    assert.equal(result.amountPaid, 0);
    assert.equal(result.balanceDue, 100);
    assert.equal(result.paymentStatus, "UNPAID");
    assert.equal(result.payments[0].method, "CREDIT");
  });

  it("refuses a short tender when udhaar is not allowed", () => {
    assert.throws(
      () => settlePayments(100, [{ method: "BANK_TRANSFER", amount: 20 }], false),
      /udhaar/,
    );
  });

  it("refuses a non-cash tender above the balance", () => {
    assert.throws(
      () => settlePayments(100, [{ method: "UPI", amount: 120 }], false),
      /exceeds the balance/,
    );
  });
});
