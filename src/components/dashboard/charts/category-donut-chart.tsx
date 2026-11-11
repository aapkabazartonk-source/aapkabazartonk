"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategorySales } from "@/types";

interface CategoryDonutChartProps {
  data: CategorySales[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  return (
    <Card className="animate-fade-in-up stagger-2">
      <CardHeader>
        <CardTitle>Sales by category</CardTitle>
        <CardDescription>Category mix in green and purple</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  boxShadow: "var(--shadow-md)",
                }}
                formatter={(value) => [`${value}%`, "Share"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-2">
          {data.map((item) => (
            <li
              key={item.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                {item.name}
              </span>
              <span className="font-medium text-foreground">{item.value}%</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
