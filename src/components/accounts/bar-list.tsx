import { cn, formatCurrency } from "@/lib/utils";

export interface BarListItem {
  label: string;
  value: number;
  tone?: "primary" | "muted" | "warning";
}

const TONE_CLASS: Record<NonNullable<BarListItem["tone"]>, string> = {
  primary: "bg-primary",
  muted: "bg-muted-foreground/40",
  warning: "bg-warning",
};

/** Lightweight horizontal bars; avoids a chart dependency for simple splits. */
export function BarList({
  items,
  emptyLabel = "No data for this period.",
}: {
  items: BarListItem[];
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 0);
  if (items.length === 0 || max === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-foreground">{item.label}</span>
            <span className="shrink-0 font-medium">
              {formatCurrency(item.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                TONE_CLASS[item.tone ?? "primary"],
              )}
              style={{
                width: `${Math.max(2, (Math.abs(item.value) / max) * 100)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
