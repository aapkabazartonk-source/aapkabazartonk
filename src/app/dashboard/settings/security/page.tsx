import type { Metadata } from "next";
import { SecuritySettingsForm } from "@/components/settings/security-settings-form";

export const metadata: Metadata = {
  title: "Security settings",
};

export default function SecuritySettingsPage() {
  return <SecuritySettingsForm />;
}
