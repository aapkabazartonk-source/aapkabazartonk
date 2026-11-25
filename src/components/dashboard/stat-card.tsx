import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStat } from "@/types";
import { cn } from "@/lib/utils";

interface StatCardProps {
  stat: DashboardStat & { href?: string };
  className?: string;
  index?: number;
  mono?: boolean;
  size?: "default" | "lg";
}

export function StatCard({
  stat,
  className,
  index = 0,
  mono = false,
  size = "default",
}: StatCardProps) {
  const TrendIcon =
    stat.trend === "up"
      ? ArrowUpRight
      : stat.trend === "down"
        ? ArrowDownRight
        : Minus;
  const large = size === "lg";

  const content = (
    <CardContent className={cn(large ? "p-6 sm:p-7" : "p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "font-medium text-muted-foreground",
            large ? "text-base" : "text-sm",
          )}
        >
          {stat.label}
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
            large ? "text-sm" : "text-xs",
            stat.trend === "up" && "bg-success-soft text-foreground",
            stat.trend === "down" && "bg-danger-soft text-destructive",
            stat.trend === "neutral" && "bg-purple-soft text-purple",
          )}
        >
          <TrendIcon className={large ? "h-4 w-4" : "h-3.5 w-3.5"} />
          {stat.change}
        </span>
      </div>
      <p
        className={cn(
          "mt-3 font-semibold tracking-tight text-foreground",
          large
            ? "text-3xl sm:text-[2.15rem] leading-none"
            : "text-2xl sm:text-[1.75rem]",
          mono && "font-mono",
        )}
      >
        {stat.value}
      </p>
      <p
        className={cn(
          "mt-2 text-muted-foreground",
          large ? "text-sm" : "text-xs",
        )}
      >
        {stat.description}
      </p>
    </CardContent>
  );

  return (
    <Card
      className={cn(
        "animate-fade-in-up border-l-4 transition-shadow hover:shadow-[var(--shadow-md)]",
        index % 2 === 0 ? "border-l-primary" : "border-l-purple",
        `stagger-${Math.min(index + 1, 6)}`,
        stat.href && "cursor-pointer focus-within:ring-2 focus-within:ring-purple/30",
        className,
      )}
    >
      {stat.href ? (
        <Link href={stat.href} className="block rounded-[inherit] outline-none">
          {content}
        </Link>
      ) : (
        content
      )}
    </Card>
  );
}
