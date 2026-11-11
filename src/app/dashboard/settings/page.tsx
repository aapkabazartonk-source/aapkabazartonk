import type { Metadata } from "next";
import { SettingsLanding } from "@/components/settings/settings-landing";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return <SettingsLanding />;
}
