import type { Metadata } from "next";
import { FinancialOverview } from "@/components/accounts/financial-overview";

export const metadata: Metadata = {
  title: "Financial Overview",
};

export default function AccountsPage() {
  return <FinancialOverview />;
}
