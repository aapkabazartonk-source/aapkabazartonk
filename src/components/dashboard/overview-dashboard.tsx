"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeSelector } from "@/components/dashboard/date-range-selector";
import { RevenueChart } from "@/components/dashboard/charts/revenue-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts";
import { TopSellingList } from "@/components/dashboard/top-selling-list";
import { RecentPurchases } from "@/components/dashboard/recent-purchases";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComparedNumber } from "@/lib/analytics/finance";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardStat } from "@/types";
import type {
  DashboardOverviewResponse,
  DashboardPreset,
} from "@/types/dashboard";

function changeLabel(metric: ComparedNumber) {
  if (!metric.comparable || metric.percent === null) return "—";
  if (metric.percent > 0) return `+${metric.percent}%`;
  return `${metric.percent}%`;
}

function trendOf(metric: ComparedNumber): DashboardStat["trend"] {
  if (!metric.comparable || metric.percent === null || metric.percent === 0) {
    return "neutral";
  }
  return metric.percent > 0 ? "up" : "down";
}

function moneyStat(
  id: string,
  label: string,
  metric: ComparedNumber,
  description: string,
  href: string,
): DashboardStat & { href: string } {
  return {
    id,
    label,
    value: metric.current === null ? "—" : formatCurrency(metric.current),
    change: changeLabel(metric),
    trend: trendOf(metric),
    description,
    href,
  };
}

function countStat(
  id: string,
  label: string,
  metric: ComparedNumber,
  description: string,
  href: string,
): DashboardStat & { href: string } {
  return {
    id,
    label,
    value: metric.current === null ? "—" : formatNumber(metric.current),
    change: changeLabel(metric),
    trend: trendOf(metric),
    description,
    href,
  };
}

function KpiSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[124px] w-full" />
      ))}
    </div>
  );
}

export function OverviewDashboard() {
  const [preset, setPreset] = useState<DashboardPreset>("last_7_days");
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useEffectEvent(async (nextPreset: DashboardPreset) => {
    setLoading(true);
    setError(null);
    setForbidden(null);
    try {
      const payload = await fetchJson<DashboardOverviewResponse>(
        `/api/dashboard/overview?preset=${encodeURIComponent(nextPreset)}`,
        { cache: "no-store" },
      );
      setData(payload);
    } catch (err) {
      setData(null);
      if (err instanceof ApiClientError && err.status === 403) {
        setForbidden(err.message);
        return;
      }
      setError(
        err instanceof Error ? err.message : "Could not load overview dashboard.",
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load(preset);
  }, [preset, reloadKey]);

  const stats =
    data == null
      ? []
      : [
          moneyStat(
            "today-sales",
            "Today's Sales",
            data.kpis.todaySales,
            "Net sales vs yesterday",
            data.kpiLinks.todaySales,
          ),
          countStat(
            "today-bills",
            "Total Bills",
            data.kpis.todayBills,
            "Completed bills today",
            data.kpiLinks.todayBills,
          ),
          moneyStat(
            "average-bill",
            "Average Bill Value",
            data.kpis.averageBill,
            data.kpis.todayBills.current === 0
              ? "No completed bills today"
              : "Today's average bill",
            data.kpiLinks.averageBill,
          ),
          countStat(
            "low-stock",
            "Low Stock Products",
            data.kpis.lowStockProducts,
            "At or below minimum stock",
            data.kpiLinks.lowStockProducts,
          ),
          moneyStat(
            "inventory-value",
            "Inventory Value",
            data.kpis.inventoryValue,
            data.valuationLabel,
            data.kpiLinks.inventoryValue,
          ),
          moneyStat(
            "payables",
            "Supplier Payables",
            data.kpis.supplierPayables,
            "Outstanding payable balance",
            data.kpiLinks.supplierPayables,
          ),
        ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Monitor inventory health, revenue, and store activity from one place."
        actions={
          <DateRangeSelector
            value={preset}
            onValueChange={setPreset}
            disabled={loading && !data}
          />
        }
      />

      {forbidden ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {forbidden}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-danger-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {loading && !data ? (
        <KpiSkeletonGrid />
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={stat.id} stat={stat} index={index} mono />
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <RevenueChart
          data={data?.salesTrend.points ?? []}
          rangeLabel={data?.range.label}
          loading={loading && !data}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentTransactions
            data={data?.recentSales ?? []}
            loading={loading && !data}
          />
        </div>
        <LowStockAlerts
          data={data?.lowStockAlerts ?? []}
          loading={loading && !data}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RecentPurchases
          data={data?.recentPurchases ?? []}
          loading={loading && !data}
        />
        <TopSellingList
          data={data?.topProducts ?? []}
          rangeLabel={data?.range.label}
          loading={loading && !data}
        />
      </div>
    </div>
  );
}
