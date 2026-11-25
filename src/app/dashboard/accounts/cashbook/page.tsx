import type { Metadata } from "next";
import { CashbookManager } from "@/components/accounts/cashbook-manager";

export const metadata: Metadata = {
  title: "Accounts & Cashbook",
};

export default function CashbookPage() {
  return <CashbookManager />;
}
