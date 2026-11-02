import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Configure store details, users, taxes, receipts, and application preferences."
      icon={Settings}
      highlights={["Store profile", "Team access", "Tax & receipts"]}
    />
  );
}
