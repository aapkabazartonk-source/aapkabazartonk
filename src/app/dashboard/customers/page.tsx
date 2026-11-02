import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "Customers",
};

export default function CustomersPage() {
  return (
    <PlaceholderPage
      title="Customers"
      description="Maintain customer profiles, purchase history, and loyalty-ready contact records."
      icon={Users}
      highlights={["Customer CRM", "Purchase history", "Contact records"]}
    />
  );
}
