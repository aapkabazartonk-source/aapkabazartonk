import type { Metadata } from "next";
import { Warehouse } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function InventoryPage() {
  return (
    <PlaceholderPage
      title="Inventory"
      description="Track stock levels, adjustments, transfers, and reorder points across your store."
      icon={Warehouse}
      highlights={["Stock movements", "Reorder alerts", "Stock valuation"]}
    />
  );
}
