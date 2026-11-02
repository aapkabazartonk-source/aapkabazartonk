import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryAlertsManager } from "@/components/inventory/inventory-alerts-manager";

export const metadata: Metadata = {
  title: "Stock Alerts",
};

export default function InventoryAlertsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading alerts...</div>}>
      <InventoryAlertsManager />
    </Suspense>
  );
}
