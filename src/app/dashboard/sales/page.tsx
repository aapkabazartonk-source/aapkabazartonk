import type { Metadata } from "next";
import { SalesManager } from "@/components/sales/sales-manager";

export const metadata: Metadata = {
  title: "Sales",
};

export default function SalesPage() {
  return <SalesManager />;
}
