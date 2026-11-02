import {
  Package,
  ShoppingCart,
  Store,
  Truck,
  UserPlus,
  Warehouse,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem, ActivityType } from "@/types";
import { cn } from "@/lib/utils";

interface RecentActivityProps {
  data: ActivityItem[];
}

const activityIcon: Record<ActivityType, typeof ShoppingCart> = {
  sale: ShoppingCart,
  stock: Warehouse,
  product: Package,
  customer: UserPlus,
  supplier: Truck,
  system: Store,
};

export function RecentActivity({ data }: RecentActivityProps) {
  return (
    <Card className="animate-fade-in-up stagger-4">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Operational events across your store</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((item, index) => {
          const Icon = activityIcon[item.type];
          const isPurple = index % 2 === 1;
          return (
            <div key={item.id} className="flex gap-3">
              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    isPurple
                      ? "bg-purple-soft text-purple"
                      : "bg-success-soft text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {index < data.length - 1 ? (
                  <div className="mt-1 w-px flex-1 bg-border" />
                ) : null}
              </div>
              <div className={cn("pb-4", index === data.length - 1 && "pb-0")}>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.timestamp}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
