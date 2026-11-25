"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Landmark,
  PiggyBank,
  Receipt,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import {
  ErrorNotice,
  ENTRY_TYPE_LABELS,
  FinancePresetSelect,
  METHOD_LABELS,
  formatDate,
} from "@/components/accounts/accounts-shared";
import { BarList } from "@/components/accounts/bar-list";
import { PageHeader } from "@/components/dashboard/page-header";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComparedNumber } from "@/lib/analytics/finance";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatCurrency } from "@/lib/utils";
import type {
  FinancePreset,
  FinancialOverviewResponse,
} from "@/types/accounts";

function money(metric: ComparedNumber) {
  return metric.current === null ? "—" : formatCurrency(metric.current);
}

function compareNote(metric: ComparedNumber, fallback: string) {
  if (!metric.comparable || metric.percent === null) return fallback;
  const sign = metric.percent > 0 ? "+" : "";
  return `${sign}${metric.percent}% vs previous period`;
}

export function FinancialOverview() {
  const [preset, setPreset] = useState<FinancePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<FinancialOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useEffectEvent(
    async (nextPreset: FinancePreset, from: string, to: string) => {
      if (nextPreset === "custom" && (!from || !to)) {
        setLoading(false);
        setError("Choose a custom start and end date.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ preset: nextPreset });
        if (nextPreset === "custom") {
          params.set("from", from);
          params.set("to", to);
        }
        const payload = await fetchJson<FinancialOverviewResponse>(
          `/api/accounts/overview?${params.toString()}`,
          { cache: "no-store" },
        );
        setData(payload);
      } catch (err) {
        setData(null);
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Could not load financial overview.",
        );
      } finally {
        setLoading(false);
      }
    },
  );

  useEffect(() => {
    void load(preset, customFrom, customTo);
  }, [preset, customFrom, customTo, reloadKey]);

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Overview"
        description="Revenue, expenses, profit, and fund balances in one view."
        actions={
          <>
            <FinancePresetSelect
              value={preset}
              onValueChange={setPreset}
              disabled={loading && !data}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
            />
            <Button variant="outline" asChild>
              <Link href="/dashboard/accounts/expenses">
                <Receipt className="h-4 w-4" />
                Expenses
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/accounts/profit-loss">
                <TrendingUp className="h-4 w-4" />
                Profit &amp; Loss
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorNotice
          message={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : null}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-[124px] w-full" />
          ))}
        </div>
      ) : kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SimpleStatCard
            label="Net sales"
            value={money(kpis.netSales)}
            description={compareNote(kpis.netSales, data?.range.label ?? "")}
            icon={TrendingUp}
            index={0}
          />
          <SimpleStatCard
            label="Gross profit"
            value={money(kpis.grossProfit)}
            description={compareNote(kpis.grossProfit, "Sales less estimated COGS")}
            icon={PiggyBank}
            index={1}
          />
          <SimpleStatCard
            label="Operating profit"
            value={money(kpis.operatingProfit)}
            description={compareNote(
              kpis.operatingProfit,
              "Gross profit less operating expenses",
            )}
            icon={Landmark}
            index={2}
          />
          <SimpleStatCard
            label="Operating expenses"
            value={money(kpis.operatingExpenses)}
            description={compareNote(
              kpis.operatingExpenses,
              "Includes staff salaries",
            )}
            icon={Receipt}
            index={3}
          />
          <SimpleStatCard
            label="Staff salaries"
            value={money(kpis.staffSalaryExpenses)}
            description={compareNote(
              kpis.staffSalaryExpenses,
              "Recognised for salary periods",
            )}
            icon={Users}
            index={4}
          />
          <SimpleStatCard
            label="Supplier payables"
            value={money(kpis.supplierPayables)}
            description="Outstanding to suppliers"
            icon={Truck}
            index={5}
          />
          <SimpleStatCard
            label="Cash in hand"
            value={money(kpis.cashInHand)}
            description="Across active cash accounts"
            icon={Banknote}
            index={6}
          />
          <SimpleStatCard
            label="Bank & UPI"
            value={money(kpis.bankBalance)}
            description="Across active bank and UPI accounts"
            icon={Wallet}
            index={7}
          />
          <SimpleStatCard
            label="Owner withdrawals"
            value={money(kpis.ownerWithdrawals)}
            description="Drawings, not an expense"
            icon={ArrowUpRight}
            index={8}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">Revenue vs expenses</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {data?.range.label ?? "Selected period"}
            </p>
            {loading && !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <BarList
                items={[
                  {
                    label: "Net sales",
                    value: data?.charts.revenueVsExpenses.revenue ?? 0,
                  },
                  {
                    label: "Operating expenses",
                    value: data?.charts.revenueVsExpenses.operatingExpenses ?? 0,
                    tone: "warning",
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">
              Gross profit vs operating expenses
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {data?.range.label ?? "Selected period"}
            </p>
            {loading && !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <BarList
                items={[
                  {
                    label: "Gross profit",
                    value: data?.charts.grossVsOperating.grossProfit ?? 0,
                  },
                  {
                    label: "Operating expenses",
                    value: data?.charts.grossVsOperating.operatingExpenses ?? 0,
                    tone: "warning",
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">Monthly profit trend</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Last 6 months operating profit
            </p>
            {loading && !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <BarList
                items={(data?.charts.monthlyProfitTrend ?? []).map((row) => ({
                  label: row.label,
                  value: row.operatingProfit ?? 0,
                }))}
                emptyLabel="Not enough history yet."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">Expenses by category</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Top categories this period
            </p>
            {loading && !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <BarList
                items={(data?.charts.expenseBreakdown ?? [])
                  .slice(0, 6)
                  .map((row) => ({
                    label: row.categoryName,
                    value: row.total,
                  }))}
                emptyLabel="No expenses recorded for this period."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">Collections by method</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Confirmed POS payments
            </p>
            {loading && !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <BarList
                items={(data?.charts.paymentMethods ?? []).map((row) => ({
                  label: METHOD_LABELS[row.method] ?? row.method,
                  value: row.amount,
                }))}
                emptyLabel="No payments collected for this period."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Recent transactions</h3>
              <p className="text-xs text-muted-foreground">
                Latest cashbook movements across all accounts.
                {data
                  ? ` Total funds ${formatCurrency(data.balances.totalFunds)}.`
                  : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/accounts/cashbook">
                <BookOpen className="h-4 w-4" />
                Cashbook
              </Link>
            </Button>
          </div>

          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.recentTransactions ?? []).map((txn) => (
                    <TableRow key={txn._id}>
                      <TableCell>{formatDate(txn.entryDate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ENTRY_TYPE_LABELS[txn.entryType] ?? txn.entryType}
                        </Badge>
                      </TableCell>
                      <TableCell>{txn.description || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {txn.transactionNumber}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.debit > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                            {formatCurrency(txn.debit)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.credit > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                            {formatCurrency(txn.credit)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.recentTransactions?.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No transactions yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {data ? (
        <Card>
          <CardContent className="space-y-2 p-5 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">
              How to read these numbers
            </p>
            <p>{data.notes.cashVsProfit}</p>
            <p>{data.notes.ownerWithdrawals}</p>
            <p>{data.notes.costNote}</p>
            <p>{data.notes.openingBalances}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
