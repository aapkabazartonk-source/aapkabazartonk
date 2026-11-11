import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard";

export const metadata: Metadata = {
  title: "Overview",
};

export default function DashboardPage() {
  return <OverviewDashboard />;
}
