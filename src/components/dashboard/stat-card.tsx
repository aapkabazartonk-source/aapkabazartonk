import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStat } from "@/types";
import { cn } from "@/lib/utils";

interface StatCardProps {
  stat: DashboardStat;
  className?: string;
  index?: number;
}

export function StatCard({ stat, className, index = 0 }: StatCardProps) {
  const TrendIcon =
    stat.trend === "up"
      ? ArrowUpRight
      : stat.trend === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <Card
      className={cn(
        "animate-fade-in-up transition-shadow hover:shadow-[var(--shadow-md)]",
        `stagger-${Math.min(index + 1, 6)}`,
        className,
      )}
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              stat.trend === "up" && "bg-success-soft text-foreground",
              stat.trend === "down" && "bg-danger-soft text-destructive",
              stat.trend === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {stat.change}
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {stat.value}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{stat.description}</p>
      </CardContent>
    </Card>
  );
}
