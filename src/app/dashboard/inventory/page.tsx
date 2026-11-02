import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryOverview } from "@/components/inventory/inventory-overview";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading inventory...</div>}>
      <InventoryOverview />
    </Suspense>
  );
}
