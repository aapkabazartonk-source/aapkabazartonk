import type { Metadata } from "next";
import { SupplierLedgerView } from "@/components/suppliers/supplier-ledger-view";

export const metadata: Metadata = {
  title: "Supplier ledger",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupplierLedgerPage({ params }: PageProps) {
  const { id } = await params;
  return <SupplierLedgerView supplierId={id} />;
}
