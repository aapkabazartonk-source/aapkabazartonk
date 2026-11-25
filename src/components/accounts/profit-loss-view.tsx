"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useEffectEvent, useState } from "react";
import { Info } from "lucide-react";
import {
  ErrorNotice,
  FinancePresetSelect,
  formatDate,
} from "@/components/accounts/accounts-shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { cn, formatCurrency } from "@/lib/utils";
import type { FinancePreset, ProfitLossResponse } from "@/types/accounts";

function StatementRow({
  label,
  value,
  note,
  indent = false,
  strong = false,
  tone,
}: {
  label: string;
  value: number | null;
  note?: string;
  indent?: boolean;
  strong?: boolean;
  tone?: "positive" | "negative";
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 sm:px-6",
        strong && "bg-secondary/50",
      )}
    >
      <div className={cn(indent && "pl-4")}>
        <p
          className={cn(
            "text-sm",
            strong ? "font-semibold text-foreground" : "text-foreground",
          )}
        >
          {label}
        </p>
        {note ? (
          <p className="text-xs text-muted-foreground">{note}</p>
        ) : null}
      </div>
      <p
        className={cn(
          "shrink-0 text-sm",
          strong ? "font-semibold" : "font-medium",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value === null ? "—" : formatCurrency(value)}
      </p>
    </div>
  );
}

function StatementSection({ title }: { title: string }) {
  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">
      {title}
    </div>
  );
}

function marginLabel(value: number | null) {
  return value === null ? "Cost data incomplete" : `${value}% gross margin`;
}

export function ProfitLossView() {
  const [preset, setPreset] = useState<FinancePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<ProfitLossResponse | null>(null);
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
        const payload = await fetchJson<ProfitLossResponse>(
          `/api/accounts/profit-loss?${params.toString()}`,
          { cache: "no-store" },
        );
        setData(payload);
      } catch (err) {
        setData(null);
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Could not load profit and loss.",
        );
      } finally {
        setLoading(false);
      }
    },
  );

  useEffect(() => {
    void load(preset, customFrom, customTo);
  }, [preset, customFrom, customTo, reloadKey]);

  const operatingTone =
    data?.operatingProfit == null
      ? undefined
      : data.operatingProfit >= 0
        ? "positive"
        : "negative";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description={
          data
            ? `${data.range.label} · ${formatDate(data.range.from)} to ${formatDate(data.range.to)}`
            : "Operating statement for the selected period."
        }
        actions={
          <FinancePresetSelect
            value={preset}
            onValueChange={setPreset}
            disabled={loading && !data}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        }
      />

      {error ? (
        <ErrorNotice
          message={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : null}

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[124px] w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SimpleStatCard
              label="Net sales"
              value={formatCurrency(data.netSales)}
              description="Excluding GST"
              index={0}
            />
            <SimpleStatCard
              label="Gross profit"
              value={
                data.grossProfit === null ? "—" : formatCurrency(data.grossProfit)
              }
              description={marginLabel(data.grossMargin)}
              index={1}
            />
            <SimpleStatCard
              label="Operating profit"
              value={
                data.operatingProfit === null
                  ? "—"
                  : formatCurrency(data.operatingProfit)
              }
              description="After operating expenses and salaries"
              index={2}
            />
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <StatementSection title="Revenue" />
              <StatementRow
                label="Net sales"
                value={data.netSales}
                note={`Invoice total ${formatCurrency(data.revenueInclusive)} including GST ${formatCurrency(data.gst)}`}
              />

              <StatementSection title="Cost of goods sold" />
              <StatementRow
                label="Estimated COGS"
                value={data.cogs}
                note={data.costStatus}
              />
              <StatementRow
                label="Gross profit"
                value={data.grossProfit}
                note={marginLabel(data.grossMargin)}
                strong
              />

              <StatementSection title="Operating expenses" />
              {data.operatingExpenses.breakdown.length === 0 ? (
                <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground sm:px-6">
                  No operating expenses recorded for this period.
                </div>
              ) : (
                data.operatingExpenses.breakdown.map((row) => (
                  <StatementRow
                    key={row.name}
                    label={row.name}
                    value={row.total}
                    indent
                  />
                ))
              )}
              <StatementRow
                label="Total operating expenses"
                value={data.operatingExpenses.total}
                note={`Other expenses ${formatCurrency(data.operatingExpenses.otherOperating)} · Staff salaries ${formatCurrency(data.operatingExpenses.staffSalaries)}`}
                strong
              />

              <StatementRow
                label="Operating profit"
                value={data.operatingProfit}
                note="Gross profit less total operating expenses"
                strong
                tone={operatingTone}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4 text-muted-foreground" />
                Limitations
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
                {data.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
