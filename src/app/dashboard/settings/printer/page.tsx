import type { Metadata } from "next";
import { PrinterSettingsForm } from "@/components/settings/printer-settings-form";

export const metadata: Metadata = {
  title: "Printer settings",
};

export default function PrinterSettingsPage() {
  return <PrinterSettingsForm />;
}
