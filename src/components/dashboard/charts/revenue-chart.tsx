"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { DashboardSalesPoint } from "@/types/dashboard";

const NET_SALES = "#A3CA69";
const COLLECTED = "#9299C9";

interface RevenueChartProps {
  data: DashboardSalesPoint[];
  rangeLabel?: string;
  loading?: boolean;
}

export function RevenueChart({
  data,
  rangeLabel,
  loading = false,
}: RevenueChartProps) {
  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Sales overview</CardTitle>
          <CardDescription>
            {rangeLabel
              ? `Net sales vs collected payments · ${rangeLabel}`
              : "Net sales vs collected payments"}
          </CardDescription>
        </div>
        <div className="hidden items-center gap-3 text-xs font-medium sm:flex">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: NET_SALES }}
            />
            Net sales
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLLECTED }}
            />
            Collected
          </span>
        </div>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading sales trend…
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No completed sales in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#E8EBE2" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#858C80", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#858C80", fontSize: 12 }}
                tickFormatter={(value) =>
                  typeof value === "number" ? formatCurrency(value) : String(value)
                }
                width={72}
              />
              <Tooltip
                cursor={{ fill: "#EDF0E5", opacity: 0.6 }}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid #E8EBE2",
                  background: "#FFFFFF",
                  color: "#252B24",
                  boxShadow: "0 8px 24px rgba(37, 43, 36, 0.06)",
                }}
                labelStyle={{ color: "#858C80", marginBottom: 4 }}
                formatter={(value, name) => [
                  formatCurrency(Number(value ?? 0)),
                  name === "netSales" ? "Net sales" : "Collected",
                ]}
              />
              <Legend
                verticalAlign="top"
                height={28}
                formatter={(value) =>
                  value === "netSales" ? "Net sales" : "Collected"
                }
              />
              <Bar
                dataKey="netSales"
                name="netSales"
                fill={NET_SALES}
                radius={[8, 8, 0, 0]}
                barSize={22}
              />
              <Bar
                dataKey="collected"
                name="collected"
                fill={COLLECTED}
                radius={[8, 8, 0, 0]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
