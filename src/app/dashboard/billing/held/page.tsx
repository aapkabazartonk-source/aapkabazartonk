import type { Metadata } from "next";
import { HeldBillsManager } from "@/components/billing/held-bills-manager";

export const metadata: Metadata = {
  title: "Held bills",
};

export default function HeldBillsPage() {
  return <HeldBillsManager />;
}
