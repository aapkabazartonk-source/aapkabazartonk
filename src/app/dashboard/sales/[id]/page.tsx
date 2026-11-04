import type { Metadata } from "next";
import { Suspense } from "react";
import { SaleDetail } from "@/components/sales/sale-detail";

export const metadata: Metadata = {
  title: "Sale",
};

export default function SalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading invoice…</p>}>
      <SaleGate params={params} />
    </Suspense>
  );
}

async function SaleGate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SaleDetail saleId={id} />;
}
