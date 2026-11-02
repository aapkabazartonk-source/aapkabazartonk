"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenuePoint } from "@/types";

const PURPLE = "#9299C9";
const GREEN = "#A3CA69";

interface RevenueChartProps {
  data: RevenuePoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Sales report</CardTitle>
          <CardDescription>
            Monthly sales (purple) and units (green)
          </CardDescription>
        </div>
        <div className="hidden items-center gap-3 text-xs font-medium sm:flex">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PURPLE }}
            />
            Sales
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: GREEN }}
            />
            Units
          </span>
        </div>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#E8EBE2" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#858C80", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#858C80", fontSize: 12 }}
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
            />
            <Bar
              dataKey="units"
              name="Units"
              stackId="report"
              fill={GREEN}
              radius={[0, 0, 0, 0]}
              barSize={28}
            />
            <Bar
              dataKey="sales"
              name="Sales"
              stackId="report"
              fill={PURPLE}
              radius={[8, 8, 0, 0]}
              barSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
