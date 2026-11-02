import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

interface TopSellingItem {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
}

interface TopSellingListProps {
  data: TopSellingItem[];
}

export function TopSellingList({ data }: TopSellingListProps) {
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader>
        <CardTitle>Top-selling products</CardTitle>
        <CardDescription>Best performers by units sold</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-3"
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                index % 2 === 0
                  ? "bg-success-soft text-foreground"
                  : "bg-purple-soft text-purple",
              )}
            >
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.category}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{formatNumber(item.unitsSold)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(item.revenue)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
