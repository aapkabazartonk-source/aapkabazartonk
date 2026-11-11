import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnalyticsCsv, buildAnalyticsPdf } from "../src/lib/analytics/export-report.ts";
import {
  catalogInventoryValue,
  compareNumbers,
  INVENTORY_VALUATION_LABEL,
  netSupplierBalance,
  profitFromLines,
  purchaseCostByProduct,
  receivedPurchaseTotal,
  summarizeSales,
} from "../src/lib/analytics/finance.ts";
import { AnalyticsError, parseAnalyticsQuery } from "../src/lib/analytics/query.ts";
import type { AnalyticsExportBundle } from "../src/lib/analytics/service.ts";
import {
  bucketKey,
  defaultGrain,
  enumerateBuckets,
  istDate,
  resolveRange,
} from "../src/lib/analytics/time.ts";

const NOW = new Date("2026-11-10T12:00:00.000Z");

describe("analytics date ranges", () => {
  it("bounds today to IST midnights", () => {
    const range = resolveRange({ preset: "today", now: NOW });
    assert.equal(range.from.toISOString(), "2026-11-09T18:30:00.000Z");
    assert.equal(range.to.toISOString(), "2026-11-10T18:30:00.000Z");
    assert.equal(range.previousFrom.toISOString(), "2026-11-08T18:30:00.000Z");
    assert.equal(range.previousTo.toISOString(), range.from.toISOString());
  });

  it("uses the previous calendar month for this month, not the financial year", () => {
    const range = resolveRange({ preset: "this_month", now: NOW });
    assert.equal(range.from.toISOString(), istDate(2026, 11, 1).toISOString());
    assert.equal(range.to.toISOString(), istDate(2026, 11, 11).toISOString());
    assert.equal(range.previousFrom.toISOString(), istDate(2026, 10, 1).toISOString());
    assert.equal(range.previousTo.toISOString(), istDate(2026, 11, 1).toISOString());
    const year = resolveRange({ preset: "this_year", now: NOW });
    assert.equal(year.previousFrom.toISOString(), istDate(2025, 1, 1).toISOString());
    assert.equal(year.from.toISOString(), istDate(2026, 1, 1).toISOString());
  });

  it("compares the previous 7 days with an equal window", () => {
    const range = resolveRange({ preset: "last_7_days", now: NOW });
    assert.equal(range.to.getTime() - range.from.getTime(), 7 * 86_400_000);
    assert.equal(range.previousTo.getTime() - range.previousFrom.getTime(), 7 * 86_400_000);
    assert.equal(range.previousTo.toISOString(), range.from.toISOString());
  });

  it("uses an equal previous window for a custom range", () => {
    const range = resolveRange({
      preset: "custom",
      now: NOW,
      from: "2026-11-01",
      to: "2026-11-03",
    });
    assert.equal(range.to.getTime() - range.from.getTime(), 3 * 86_400_000);
    assert.equal(range.from.getTime() - range.previousFrom.getTime(), 3 * 86_400_000);
  });

  it("rejects an inverted custom range and an impossible day", () => {
    assert.throws(
      () => resolveRange({ preset: "custom", from: "2026-11-10", to: "2026-11-01" }),
      /start date/i,
    );
    assert.throws(
      () => resolveRange({ preset: "custom", from: "2026-02-31", to: "2026-03-01" }),
      /valid/i,
    );
  });

  it("picks a grain from the length of the range and stops hourly charts at the current hour", () => {
    const today = resolveRange({ preset: "today", now: NOW });
    assert.equal(defaultGrain(today.from, today.to), "hour");
    const month = resolveRange({ preset: "last_30_days", now: NOW });
    assert.equal(defaultGrain(month.from, month.to), "day");
    const hours = enumerateBuckets(today.from, today.to, "hour", NOW);
    assert.equal(hours.length, 18);
    assert.equal(hours[0], bucketKey(today.from, "hour"));
    assert.equal(hours.at(-1), "2026-11-10T17");
  });
});

describe("analytics finance", () => {
  it("returns no growth percentage when the previous value is zero", () => {
    const change = compareNumbers(100, 0);
    assert.equal(change.percent, null);
    assert.equal(change.delta, 100);
    assert.equal(compareNumbers(0, 0).percent, null);
    assert.equal(compareNumbers(0, 80).percent, -100);
  });

  it("keeps GST out of net sales and ignores drafts, cancellations, and credit", () => {
    const summary = summarizeSales(
      [
        {
          saleStatus: "COMPLETED",
          grandTotal: 118,
          taxableAmount: 100,
          totalTax: 18,
          items: [{ quantity: 2 }],
        },
        {
          saleStatus: "CANCELLED",
          grandTotal: 500,
          taxableAmount: 500,
          totalTax: 0,
          items: [{ quantity: 9 }],
        },
        {
          saleStatus: "DRAFT",
          grandTotal: 40,
          taxableAmount: 40,
          totalTax: 0,
          items: [{ quantity: 1 }],
        },
      ],
      [
        { status: "CONFIRMED", amount: 40 },
        { status: "MANUALLY_CONFIRMED", amount: 20 },
        { status: "CREDIT", amount: 58 },
      ],
    );
    assert.equal(summary.revenue, 118);
    assert.equal(summary.netSales, 100);
    assert.equal(summary.gst, 18);
    assert.equal(summary.bills, 1);
    assert.equal(summary.units, 2);
    assert.equal(summary.collected, 60);
    assert.notEqual(summary.netSales, summary.revenue);
  });

  it("counts only received purchases", () => {
    assert.equal(
      receivedPurchaseTotal([
        { status: "RECEIVED", total: 400 },
        { status: "DRAFT", total: 900 },
        { status: "CANCELLED", total: 90 },
      ]),
      400,
    );
  });

  it("estimates COGS from received purchase cost and does not treat missing cost as zero", () => {
    const costs = purchaseCostByProduct([
      {
        discount: 10,
        items: [
          { productId: "rice", quantity: 1, purchasePrice: 100, lineDiscount: 0 },
          { productId: "oil", quantity: 1, purchasePrice: 100, lineDiscount: 0 },
        ],
      },
    ]);
    const rice = costs.find((cost) => cost.productId === "rice");
    assert.equal(rice?.costPaise, 9500);

    const estimated = profitFromLines(
      [{ productId: "rice", quantity: 1, netSales: 150, revenue: 177 }],
      costs,
    );
    assert.equal(estimated.status, "estimated");
    assert.equal(estimated.cogs, 95);
    assert.equal(estimated.grossProfit, 55);
    assert.equal(estimated.grossMargin, 36.67);

    const partial = profitFromLines(
      [
        { productId: "rice", quantity: 2, netSales: 200, revenue: 236 },
        { productId: "soap", quantity: 1, netSales: 50, revenue: 50 },
      ],
      [{ productId: "rice", receivedQuantity: 1, costPaise: 4000 }],
    );
    assert.equal(partial.status, "partial");
    assert.equal(partial.cogs, 40);
    assert.equal(partial.coveredNetSales, 100);
    assert.equal(partial.uncoveredNetSales, 150);
    assert.equal(partial.grossProfit, 60);
    assert.notEqual(partial.grossProfit, partial.netSales);

    const missing = profitFromLines(
      [{ productId: "soap", quantity: 3, netSales: 90, revenue: 90 }],
      [],
    );
    assert.equal(missing.status, "unavailable");
    assert.equal(missing.cogs, null);
    assert.equal(missing.grossProfit, null);
    assert.equal(missing.grossMargin, null);
    assert.equal(missing.uncoveredNetSales, 90);
  });

  it("returns a null margin when there is no covered net sales", () => {
    const empty = profitFromLines([], []);
    assert.equal(empty.grossProfit, 0);
    assert.equal(empty.grossMargin, null);
    assert.equal(empty.cogs, 0);
  });

  it("values stock with the catalog purchase price and sums supplier balances", () => {
    assert.equal(INVENTORY_VALUATION_LABEL, "Catalog purchase price × on-hand quantity");
    assert.equal(
      catalogInventoryValue([
        { isActive: true, currentStock: 8, purchasePrice: 10 },
        { isActive: true, currentStock: 5, purchasePrice: 5 },
        { isActive: false, currentStock: 100, purchasePrice: 100 },
      ]),
      105,
    );
    assert.equal(netSupplierBalance([250, -40, 0]), 210);
  });
});

describe("analytics query and export", () => {
  it("rejects a custom range without dates", () => {
    assert.throws(
      () => parseAnalyticsQuery(new URLSearchParams({ preset: "custom" }), NOW),
      AnalyticsError,
    );
  });

  it("writes a CSV that names the business and neutralises formula text", () => {
    const bundle = {
      businessName: "=hidden",
      rowCap: 5000,
      overview: {
        range: { label: "10 Nov 2026" },
        previousRange: { label: "9 Nov 2026" },
        generatedAt: "2026-11-10T12:00:00.000Z",
        timezone: "Asia/Kolkata",
        valuationLabel: INVENTORY_VALUATION_LABEL,
        payablesNote: "Current balance",
        returnsNote: "Returns are not recorded",
        kpis: {
          revenue: compareNumbers(100, 80),
          netSales: compareNumbers(90, 70),
          collected: compareNumbers(40, 0),
          grossProfit: compareNumbers(null, null),
          grossMargin: compareNumbers(null, null),
          bills: compareNumbers(2, 1),
          averageBill: compareNumbers(50, 80),
          unitsSold: compareNumbers(3, 1),
          purchases: compareNumbers(20, 20),
          inventoryValue: { current: 105, previous: null, delta: null, percent: null, comparable: false },
          payables: { current: 250, previous: null, delta: null, percent: null, comparable: false },
          costStatus: "unavailable",
          costNote: "Cost not recorded",
        },
      },
      profit: { expensesNote: "Expenses not configured", gst: 10, cogs: null },
      categories: { categories: [] },
      payments: { methods: [], creditOutstanding: 58 },
      products: { rows: [] },
      purchases: { suppliers: [] },
    } as unknown as AnalyticsExportBundle;
    const csv = buildAnalyticsCsv(bundle);
    assert.match(csv, /Business Analytics/);
    assert.match(csv, /'=hidden/);
    assert.match(csv, /Expenses not configured/);
    assert.match(csv, /10 Nov 2026/);
  });

  it("builds a PDF report", async () => {
    const bundle = {
      businessName: "Aapka Bazar",
      rowCap: 5000,
      overview: {
        range: { label: "10 Nov 2026" },
        previousRange: { label: "9 Nov 2026" },
        generatedAt: "2026-11-10T12:00:00.000Z",
        timezone: "Asia/Kolkata",
        valuationLabel: INVENTORY_VALUATION_LABEL,
        payablesNote: "Current balance",
        returnsNote: "Returns are not recorded",
        kpis: {
          revenue: compareNumbers(100, 50),
          netSales: compareNumbers(90, 40),
          collected: compareNumbers(40, 40),
          grossProfit: compareNumbers(10, 5),
          grossMargin: compareNumbers(11.11, 12.5),
          bills: compareNumbers(1, 1),
          averageBill: compareNumbers(100, 50),
          unitsSold: compareNumbers(1, 1),
          purchases: compareNumbers(0, 0),
          inventoryValue: { current: 10, previous: null, delta: null, percent: null, comparable: false },
          payables: { current: 0, previous: null, delta: null, percent: null, comparable: false },
        },
      },
      profit: { costNote: "Estimated", expensesNote: "Expenses not configured", returnsNote: "Returns are not recorded" },
      categories: { categories: [{ name: "Grocery", revenue: 100, units: 1, share: 100 }] },
      payments: { methods: [{ label: "Cash", amount: 40, percent: 100 }], creditOutstanding: 0 },
      products: { rows: [{ name: "Rice", sku: "RICE", category: "Grocery", quantity: 1, revenue: 100, grossProfit: 10 }] },
      purchases: { suppliers: [{ name: "Acme", total: 40, quantity: 1 }] },
    } as unknown as AnalyticsExportBundle;
    const pdf = await buildAnalyticsPdf(bundle);
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), "%PDF-");
  });
});
