import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LowStockAlert } from "@/types";
import { cn } from "@/lib/utils";

interface LowStockAlertsProps {
  data: LowStockAlert[];
}

export function LowStockAlerts({ data }: LowStockAlertsProps) {
  return (
    <Card className="animate-fade-in-up stagger-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-soft">
            <AlertTriangle className="h-4 w-4 text-purple" />
          </span>
          Low stock alerts
        </CardTitle>
        <CardDescription>Products below reorder threshold</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-2xl border border-border px-3.5 py-3",
              index % 2 === 0 ? "bg-success-soft/40" : "bg-purple-soft/50",
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.sku}</p>
            </div>
            <div className="text-right">
              <Badge variant={index % 2 === 0 ? "success" : "purple"}>
                {item.stock} left
              </Badge>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Reorder at {item.reorderLevel}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
