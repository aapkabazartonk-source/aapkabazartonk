import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "Suppliers",
};

export default function SuppliersPage() {
  return (
    <PlaceholderPage
      title="Suppliers"
      description="Manage supplier contacts, purchase orders, and inbound inventory relationships."
      icon={Truck}
      highlights={["Supplier directory", "Purchase orders", "Inbound stock"]}
    />
  );
}
