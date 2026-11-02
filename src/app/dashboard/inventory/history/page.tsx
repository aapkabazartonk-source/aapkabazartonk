import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryHistoryManager } from "@/components/inventory/inventory-history-manager";

export const metadata: Metadata = {
  title: "Inventory History",
};

export default function InventoryHistoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading history...</div>}>
      <InventoryHistoryManager />
    </Suspense>
  );
}
