"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardQuickAccess } from "@/components/dashboard/dashboard-quick-access";
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
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 10 }).map((_, index) => (
        <Skeleton key={index} className="h-[148px] w-full" />
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
            "today-cash",
            "Cash Collected Today",
            data.kpis.todayCashCollected,
            "Confirmed cash payments vs yesterday",
            data.kpiLinks.todayCashCollected,
          ),
          moneyStat(
            "today-online",
            "Online Collected Today",
            data.kpis.todayOnlineCollected,
            "UPI + Card + Bank vs yesterday",
            data.kpiLinks.todayOnlineCollected,
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
          countStat(
            "total-customers",
            "Total Customers",
            data.kpis.totalCustomers,
            "Active customers in directory",
            data.kpiLinks.totalCustomers,
          ),
          countStat(
            "new-customers",
            "New Customers This Month",
            data.kpis.newCustomersThisMonth,
            "Added in the current calendar month",
            data.kpiLinks.newCustomersThisMonth,
          ),
        ];

  const financeStats =
    data == null
      ? []
      : [
          moneyStat(
            "finance-revenue",
            "Revenue",
            data.finance.revenue,
            data.range.label,
            data.kpiLinks.finance,
          ),
          moneyStat(
            "finance-gross",
            "Gross Profit",
            data.finance.grossProfit,
            "Sales less estimated COGS",
            data.kpiLinks.finance,
          ),
          moneyStat(
            "finance-opex",
            "Operating Expenses",
            data.finance.operatingExpenses,
            "Expenses and salaries",
            data.kpiLinks.finance,
          ),
          moneyStat(
            "finance-op-profit",
            "Operating Profit",
            data.finance.operatingProfit,
            "Gross profit less expenses",
            data.kpiLinks.finance,
          ),
          moneyStat(
            "finance-cash",
            "Cash & Bank",
            data.finance.cashAndBank,
            "Funds on hand, not profit",
            data.kpiLinks.finance,
          ),
        ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Monitor inventory health, revenue, and store activity from one place."
        actions={
          <DateRangeSelector
            value={preset}
            onValueChange={setPreset}
            disabled={loading && !data}
          />
        }
      />

      <DashboardQuickAccess />

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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={stat.id} stat={stat} index={index} mono size="lg" />
          ))}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[148px] w-full" />
          ))}
        </div>
      ) : data ? (
        <div className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                Accounts snapshot
              </h2>
              <p className="text-sm text-muted-foreground">
                Open Accounts &amp; Expenses for the full cashbook and P&amp;L.
              </p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {financeStats.map((stat, index) => (
              <StatCard key={stat.id} stat={stat} index={index} mono size="lg" />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <RevenueChart
          data={data?.salesTrend.points ?? []}
          rangeLabel={data?.range.label}
          loading={loading && !data}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
