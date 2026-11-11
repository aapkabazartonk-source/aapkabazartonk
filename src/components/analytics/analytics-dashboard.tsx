"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStat } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  CategoryPanel,
  ComparisonTable,
  InventoryPanel,
  PaymentPanel,
  ProductPanel,
  ProfitPanel,
  PurchasePanel,
  RevenuePanel,
  SalesPanel,
  type AnalyticsPayloads,
  type ProductsPayload,
} from "@/components/analytics/analytics-panels";

const PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last_7_days", "Last 7 days"],
  ["last_30_days", "Last 30 days"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["this_year", "This year"],
  ["custom", "Custom range"],
] as const;

type Preset = (typeof PRESETS)[number][0];

class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(path: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(`${path}?${params.toString()}`, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new RequestError(body.error || "Could not load analytics.", response.status);
  }
  return body as T;
}

function changeLabel(percent: number | null, comparable: boolean) {
  if (!comparable || percent === null) return "—";
  if (percent > 0) return `+${percent}%`;
  return `${percent}%`;
}

function trendOf(percent: number | null, comparable: boolean): DashboardStat["trend"] {
  if (!comparable || percent === null || percent === 0) return "neutral";
  return percent > 0 ? "up" : "down";
}

function moneyStat(
  id: string,
  label: string,
  metric: { current: number | null; previous: number | null; percent: number | null; comparable: boolean },
  description: string,
): DashboardStat {
  return {
    id,
    label,
    value: metric.current === null ? "Unavailable" : formatCurrency(metric.current),
    change: changeLabel(metric.percent, metric.comparable),
    trend: trendOf(metric.percent, metric.comparable),
    description,
  };
}

export function AnalyticsDashboard() {
  const [preset, setPreset] = useState<Preset>("last_30_days");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [grain, setGrain] = useState("auto");
  const [slowDays, setSlowDays] = useState<"30" | "60" | "90">("30");
  const [view, setView] = useState("top_revenue");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AnalyticsPayloads | null>(null);
  const [productData, setProductData] = useState<ProductsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const ready = preset !== "custom" || (Boolean(from) && Boolean(to) && from <= to);

  const baseParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("preset", preset);
    if (preset === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    if (grain !== "auto") params.set("grain", grain);
    params.set("slowDays", slowDays);
    return params;
  }, [preset, from, to, grain, slowDays]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const params = baseParams;
    Promise.all([
      getJson<AnalyticsPayloads["overview"]>("/api/analytics/overview", params),
      getJson<AnalyticsPayloads["revenue"]>("/api/analytics/revenue", params),
      getJson<AnalyticsPayloads["sales"]>("/api/analytics/sales", params),
      getJson<AnalyticsPayloads["categories"]>("/api/analytics/categories", params),
      getJson<AnalyticsPayloads["payments"]>("/api/analytics/payments", params),
      getJson<AnalyticsPayloads["profit"]>("/api/analytics/profit-loss", params),
      getJson<AnalyticsPayloads["inventory"]>("/api/analytics/inventory", params),
      getJson<AnalyticsPayloads["purchases"]>("/api/analytics/purchases", params),
    ])
      .then(([overview, revenue, sales, categories, payments, profit, inventory, purchases]) => {
        if (!active) return;
        setData({ overview, revenue, sales, categories, payments, profit, inventory, purchases });
        setError(null);
        setForbidden(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof RequestError && reason.status === 403) {
          setForbidden(reason.message);
          setData(null);
          return;
        }
        setError(reason instanceof Error ? reason.message : "Could not load analytics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [baseParams, ready]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const params = new URLSearchParams(baseParams);
    params.set("view", view);
    params.set("page", String(page));
    params.set("limit", "10");
    getJson<ProductsPayload>("/api/analytics/products", params)
      .then((products) => {
        if (!controller.signal.aborted) setProductData(products);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof RequestError && reason.status === 403) return;
        toast.error(reason instanceof Error ? reason.message : "Could not load products.");
      });
    return () => controller.abort();
  }, [baseParams, ready, view, page]);

  async function exportReport(format: "csv" | "pdf") {
    if (!ready) return;
    setExporting(format);
    try {
      const params = new URLSearchParams(baseParams);
      params.set("format", format);
      const response = await fetch(`/api/analytics/export?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `business-analytics.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const overview = data?.overview;

  return (
    <div>
      <PageHeader
        title="Business Analytics"
        description="Revenue, profit, inventory, and supplier payables for the selected period. Customer profiles are not part of this report."
        actions={
          <>
            <Select
              value={preset}
              onValueChange={(value) => {
                setPreset(value as Preset);
                setPage(1);
                setError(null);
                if (value !== "custom") setLoading(true);
              }}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={grain}
              onValueChange={(value) => {
                setGrain(value);
                setLoading(true);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Grain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="hour">Hourly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!ready || exporting !== null}
              onClick={() => exportReport("csv")}
            >
              <FileSpreadsheet />
              {exporting === "csv" ? "Exporting" : "CSV"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!ready || exporting !== null}
              onClick={() => exportReport("pdf")}
            >
              <Download />
              {exporting === "pdf" ? "Exporting" : "PDF"}
            </Button>
          </>
        }
      />

      {preset === "custom" ? (
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm text-muted-foreground">
            From
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                const next = event.target.value;
                setFrom(next);
                setPage(1);
                if (next && to && next <= to) setLoading(true);
              }}
            />
          </label>
          <label className="space-y-1 text-sm text-muted-foreground">
            To
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                const next = event.target.value;
                setTo(next);
                setPage(1);
                if (from && next && from <= next) setLoading(true);
              }}
            />
          </label>
          {from && to && from > to ? (
            <p className="text-sm text-destructive">The start date must be on or before the end date.</p>
          ) : null}
        </div>
      ) : null}

      {forbidden ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          {forbidden}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <>
          {loading ? (
            <p className="mb-2 text-xs text-muted-foreground">Updating figures…</p>
          ) : null}
          <p className="mb-4 text-sm text-muted-foreground">
            {overview.range.label}
            <span className="mx-2 text-border">·</span>
            Compared with {overview.previousRange.label}
            <span className="mx-2 text-border">·</span>
            Calculated {new Date(overview.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard mono index={0} stat={moneyStat("revenue", "Total revenue", overview.kpis.revenue, `Collected ${formatCurrency(overview.kpis.collected.current ?? 0)}`)} />
            <StatCard mono index={1} stat={moneyStat("net", "Net sales", overview.kpis.netSales, "Excludes GST, after discounts")} />
            <StatCard mono index={2} stat={moneyStat("profit", "Gross profit", overview.kpis.grossProfit, overview.kpis.costNote)} />
            <StatCard
              index={3}
              stat={{
                id: "margin",
                label: "Gross profit margin",
                value: overview.kpis.grossMargin.current === null ? "Unavailable" : `${overview.kpis.grossMargin.current}%`,
                change: changeLabel(overview.kpis.grossMargin.percent, overview.kpis.grossMargin.comparable),
                trend: trendOf(overview.kpis.grossMargin.percent, overview.kpis.grossMargin.comparable),
                description: "Gross profit ÷ covered net sales",
              }}
            />
            <StatCard
              index={4}
              stat={{
                id: "bills",
                label: "Total bills",
                value: formatNumber(overview.kpis.bills.current ?? 0),
                change: changeLabel(overview.kpis.bills.percent, overview.kpis.bills.comparable),
                trend: trendOf(overview.kpis.bills.percent, overview.kpis.bills.comparable),
                description: "Completed sales only",
              }}
            />
            <StatCard mono index={5} stat={moneyStat("average", "Average bill value", overview.kpis.averageBill, "Revenue ÷ bills")} />
            <StatCard
              index={6}
              stat={{
                id: "units",
                label: "Units sold",
                value: formatNumber(overview.kpis.unitsSold.current ?? 0),
                change: changeLabel(overview.kpis.unitsSold.percent, overview.kpis.unitsSold.comparable),
                trend: trendOf(overview.kpis.unitsSold.percent, overview.kpis.unitsSold.comparable),
                description: "Completed sale quantities",
              }}
            />
            <StatCard mono index={0} stat={moneyStat("purchases", "Total purchases", overview.kpis.purchases, "Received purchases, GST included")} />
            <StatCard
              mono
              index={1}
              stat={moneyStat("valuation", "Inventory valuation", overview.kpis.inventoryValue, overview.valuationLabel)}
            />
            <StatCard
              mono
              index={2}
              stat={moneyStat("payables", "Outstanding supplier payables", overview.kpis.payables, "Current balance, not limited to this range")}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{overview.returnsNote}</p>

          {data ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <RevenuePanel data={data.revenue} />
                </div>
                <SalesPanel data={data.sales} />
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                <CategoryPanel data={data.categories} />
                <PaymentPanel data={data.payments} />
              </div>
              <ProfitPanel data={data.profit} />
              <ProductPanel
                data={productData}
                view={view}
                slowDays={slowDays}
                onView={(next) => {
                  setView(next);
                  setPage(1);
                }}
                onSlowDays={(days) => {
                  setSlowDays(days);
                  setPage(1);
                  setLoading(true);
                }}
                onPage={setPage}
              />
              <InventoryPanel data={data.inventory} />
              <PurchasePanel data={data.purchases} />
              <ComparisonTable rows={overview.comparison} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
