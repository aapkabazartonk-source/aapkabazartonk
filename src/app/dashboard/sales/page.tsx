import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "Sales & Orders",
};

export default function SalesPage() {
  return (
    <PlaceholderPage
      title="Sales & Orders"
      description="Review order history, refunds, payment status, and fulfillment details."
      icon={ShoppingCart}
      highlights={["Order history", "Refunds", "Payment tracking"]}
    />
  );
}
