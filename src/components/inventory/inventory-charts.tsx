"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface InventoryChartsProps {
  stockMovementTrend: Array<{
    date: string;
    stockIn: number;
    stockOut: number;
  }>;
  stockByCategory: Array<{ name: string; value: number; fill: string }>;
  valuationByCategory: Array<{ name: string; value: number; fill: string }>;
}

export function InventoryCharts({
  stockMovementTrend,
  stockByCategory,
  valuationByCategory,
}: InventoryChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <Card className="animate-fade-in-up xl:col-span-2">
        <CardHeader>
          <CardTitle>Stock movement trend</CardTitle>
          <CardDescription>Daily stock in vs stock out</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] pt-0">
          {stockMovementTrend.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No stock movements in this period yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stockMovementTrend}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#E8EBE2"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#858C80", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#858C80", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid #E8EBE2",
                    background: "#FFFFFF",
                  }}
                />
                <Bar dataKey="stockIn" name="Stock in" fill="#A3CA69" radius={[6, 6, 0, 0]} />
                <Bar dataKey="stockOut" name="Stock out" fill="#9299C9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-2">
        <CardHeader>
          <CardTitle>Stock by category</CardTitle>
          <CardDescription>Units currently on hand</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {stockByCategory.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No stock distribution data.
            </p>
          ) : (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockByCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {stockByCategory.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatNumber(Number(value)), "Units"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {stockByCategory.slice(0, 5).map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      {item.name}
                    </span>
                    <span className="font-medium">{formatNumber(item.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-3 lg:col-span-2 xl:col-span-3">
        <CardHeader>
          <CardTitle>Inventory valuation by category</CardTitle>
          <CardDescription>Purchase-cost value of current stock</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px] pt-0">
          {valuationByCategory.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No valuation data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={valuationByCategory}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#E8EBE2"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#858C80", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#858C80", fontSize: 12 }}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Value"]}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid #E8EBE2",
                    background: "#FFFFFF",
                  }}
                />
                <Bar dataKey="value" name="Value" radius={[8, 8, 0, 0]}>
                  {valuationByCategory.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
