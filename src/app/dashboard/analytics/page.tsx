import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function AnalyticsPage() {
  return (
    <PlaceholderPage
      title="Analytics"
      description="Dive deeper into revenue trends, product performance, and inventory efficiency."
      icon={BarChart3}
      highlights={["Trend analysis", "Product KPIs", "Inventory insights"]}
    />
  );
}
