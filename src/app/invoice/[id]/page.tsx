import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoicePrintView } from "@/components/billing/invoice-print-view";

export const metadata: Metadata = {
  title: "Invoice",
};

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading invoice…</p>}>
      <InvoiceGate params={params} />
    </Suspense>
  );
}

async function InvoiceGate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoicePrintView invoiceId={id} />;
}
