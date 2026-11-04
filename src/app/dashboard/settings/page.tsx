import type { Metadata } from "next";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return <BusinessSettingsForm />;
}
