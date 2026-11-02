import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeSelector } from "@/components/dashboard/date-range-selector";
import { RevenueChart } from "@/components/dashboard/charts/revenue-chart";
import { CategoryDonutChart } from "@/components/dashboard/charts/category-donut-chart";
import { TopProductsChart } from "@/components/dashboard/charts/top-products-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts";
import { TopSellingList } from "@/components/dashboard/top-selling-list";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Badge } from "@/components/ui/badge";
import {
  SAMPLE_ACTIVITY,
  SAMPLE_CATEGORY_SALES,
  SAMPLE_LOW_STOCK,
  SAMPLE_REVENUE,
  SAMPLE_STATS,
  SAMPLE_TOP_PRODUCTS_CHART,
  SAMPLE_TOP_SELLING,
  SAMPLE_TRANSACTIONS,
} from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Overview",
};

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="Monitor inventory health, revenue, and store activity from one place."
        actions={
          <>
            <Badge variant="purple">Sample data</Badge>
            <DateRangeSelector />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_STATS.map((stat, index) => (
          <StatCard key={stat.id} stat={stat} index={index} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart data={SAMPLE_REVENUE} />
        </div>
        <CategoryDonutChart data={SAMPLE_CATEGORY_SALES} />
      </div>

      <div className="mt-6">
        <TopProductsChart data={SAMPLE_TOP_PRODUCTS_CHART} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentTransactions data={SAMPLE_TRANSACTIONS} />
        </div>
        <LowStockAlerts data={SAMPLE_LOW_STOCK} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TopSellingList data={SAMPLE_TOP_SELLING} />
        <RecentActivity data={SAMPLE_ACTIVITY} />
      </div>
    </div>
  );
}
