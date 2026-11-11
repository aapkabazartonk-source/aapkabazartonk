import type { Metadata } from "next";
import { BillingSettingsForm } from "@/components/settings/billing-settings-form";

export const metadata: Metadata = {
  title: "Billing settings",
};

export default function BillingSettingsPage() {
  return <BillingSettingsForm />;
}
