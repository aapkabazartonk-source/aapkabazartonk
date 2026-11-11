import type { Metadata } from "next";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";

export const metadata: Metadata = {
  title: "Business settings",
};

export default function BusinessSettingsPage() {
  return <BusinessProfileForm />;
}
