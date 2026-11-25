import type { Metadata } from "next";
import { ProfitLossView } from "@/components/accounts/profit-loss-view";

export const metadata: Metadata = {
  title: "Profit & Loss",
};

export default function ProfitLossPage() {
  return <ProfitLossView />;
}
