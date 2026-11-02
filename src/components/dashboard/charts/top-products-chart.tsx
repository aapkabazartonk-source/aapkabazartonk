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
import type { TopProductSale } from "@/types";

const PURPLE = "#9299C9";

interface TopProductsChartProps {
  data: TopProductSale[];
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader>
        <CardTitle>Top-selling products</CardTitle>
        <CardDescription>Units sold this period</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#E8EBE2" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#858C80", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#858C80", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 14,
                border: "1px solid #E8EBE2",
                background: "#FFFFFF",
                color: "#252B24",
                boxShadow: "0 8px 24px rgba(37, 43, 36, 0.06)",
              }}
              formatter={(value) => [value, "Units sold"]}
            />
            <Bar
              dataKey="sales"
              fill={PURPLE}
              radius={[0, 8, 8, 0]}
              barSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
