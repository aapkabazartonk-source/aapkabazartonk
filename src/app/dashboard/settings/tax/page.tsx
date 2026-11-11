import type { Metadata } from "next";
import { TaxSettingsForm } from "@/components/settings/tax-settings-form";

export const metadata: Metadata = {
  title: "Tax settings",
};

export default function TaxSettingsPage() {
  return <TaxSettingsForm />;
}
