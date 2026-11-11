import type { Metadata } from "next";
import { SuppliersManager } from "@/components/suppliers/suppliers-manager";

export const metadata: Metadata = {
  title: "Suppliers",
};

export default function SuppliersPage() {
  return <SuppliersManager />;
}
