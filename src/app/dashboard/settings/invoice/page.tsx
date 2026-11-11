import type { Metadata } from "next";
import { InvoiceSettingsForm } from "@/components/settings/invoice-settings-form";

export const metadata: Metadata = {
  title: "Invoice settings",
};

export default function InvoiceSettingsPage() {
  return <InvoiceSettingsForm />;
}
