import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averageBill,
} from "../src/lib/analytics/service.ts";
import {
  compareNumbers,
  summarizeSales,
} from "../src/lib/analytics/finance.ts";
import {
  DashboardError,
  parseDashboardPreset,
} from "../src/lib/dashboard-service.ts";
import { resolveRange } from "../src/lib/analytics/time.ts";

const NOW = new Date("2026-11-10T12:00:00.000Z");

describe("dashboard presets", () => {
  it("defaults to last 7 days and accepts the overview filters", () => {
    assert.equal(parseDashboardPreset(null), "last_7_days");
    assert.equal(parseDashboardPreset("today"), "today");
    assert.equal(parseDashboardPreset("last_30_days"), "last_30_days");
    assert.equal(parseDashboardPreset("this_month"), "this_month");
  });

  it("rejects unsupported ranges", () => {
    assert.throws(
      () => parseDashboardPreset("yesterday"),
      (error: unknown) =>
        error instanceof DashboardError && /Today, Last 7 days/i.test(error.message),
    );
  });
});

describe("dashboard KPI formulas", () => {
  it("uses net sales for today's sales and revenue/bills for average bill", () => {
    const summary = summarizeSales(
      [
        {
          saleStatus: "COMPLETED",
          grandTotal: 236,
          taxableAmount: 200,
          totalTax: 36,
          items: [{ quantity: 2 }],
        },
        {
          saleStatus: "COMPLETED",
          grandTotal: 118,
          taxableAmount: 100,
          totalTax: 18,
          items: [{ quantity: 1 }],
        },
        {
          saleStatus: "DRAFT",
          grandTotal: 999,
          taxableAmount: 999,
          totalTax: 0,
          items: [{ quantity: 9 }],
        },
      ],
      [
        { status: "CONFIRMED", amount: 236 },
        { status: "CREDIT", amount: 118 },
      ],
    );

    assert.equal(summary.netSales, 300);
    assert.equal(summary.bills, 2);
    assert.equal(summary.collected, 236);
    assert.equal(averageBill(summary.revenue, summary.bills), 177);
    assert.equal(averageBill(0, 0), null);
  });

  it("does not invent growth when the previous period is zero", () => {
    const change = compareNumbers(120, 0);
    assert.equal(change.percent, null);
    assert.equal(change.comparable, true);
    assert.equal(change.delta, 120);
  });

  it("aligns overview presets with analytics ranges", () => {
    for (const preset of [
      "today",
      "last_7_days",
      "last_30_days",
      "this_month",
    ] as const) {
      const range = resolveRange({ preset, now: NOW });
      assert.ok(range.from.getTime() < range.to.getTime());
      assert.equal(range.previousTo.toISOString(), range.from.toISOString());
    }
  });
});
