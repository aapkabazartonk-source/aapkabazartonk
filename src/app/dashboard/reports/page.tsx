import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <PlaceholderPage
      title="Reports"
      description="Generate sales, inventory, tax, and supplier reports ready for export."
      icon={FileText}
      highlights={["Sales reports", "Tax summaries", "CSV / PDF export"]}
    />
  );
}
