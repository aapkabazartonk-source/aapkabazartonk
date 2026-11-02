import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SimpleStatCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  index?: number;
}

export function SimpleStatCard({
  label,
  value,
  description,
  icon: Icon,
  className,
  index = 0,
}: SimpleStatCardProps) {
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
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-foreground">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {value}
        </p>
        {description ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
