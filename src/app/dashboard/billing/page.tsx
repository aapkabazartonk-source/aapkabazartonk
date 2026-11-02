import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "POS Billing",
};

export default function BillingPage() {
  return (
    <PlaceholderPage
      title="POS Billing"
      description="Fast point-of-sale billing with cart, payments, invoices, and receipt printing."
      icon={Receipt}
      highlights={["Quick cart", "Multi-payment", "Receipts"]}
    />
  );
}
