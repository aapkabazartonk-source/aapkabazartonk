"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InvoiceDocument, type InvoicePaper } from "@/components/billing/invoice-document";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import type { PaymentRecord, SaleRecord } from "@/types/billing";

export function InvoicePrintView({ invoiceId }: { invoiceId: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("format");
  const format: InvoicePaper = requested === "58" || requested === "80" || requested === "a4" ? requested : "a4";
  const [sale, setSale] = useState<SaleRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ data: { sale: SaleRecord; payments: PaymentRecord[] } }>(`/api/invoices/${invoiceId}`)
      .then((response) => {
        if (cancelled) return;
        setSale(response.data.sale);
        setPayments(response.data.payments);
      })
      .catch(() => {
        if (!cancelled) setError("This invoice could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    if (!sale || searchParams.get("autoprint") !== "1") return;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [sale, searchParams]);

  const pageSize = format === "58" ? "58mm auto" : format === "80" ? "80mm auto" : "A4";

  return (
    <div className="min-h-screen bg-neutral-100 py-6">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } @page { size: ${pageSize}; margin: 4mm; } }`}</style>
      <div className="no-print mx-auto mb-4 flex w-full max-w-3xl flex-wrap items-center gap-2 px-4">
        <Button asChild variant="outline">
          <Link href={`/invoice/${invoiceId}?format=58`}>58mm</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/invoice/${invoiceId}?format=80`}>80mm</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/invoice/${invoiceId}?format=a4`}>A4</Link>
        </Button>
        <Button type="button" className="bg-[#128C7E] text-white hover:bg-[#075E54]" onClick={() => window.print()}>
          Print
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/invoices/${invoiceId}?format=pdf`}>PDF</a>
        </Button>
      </div>
      {error ? <p className="px-4 text-sm">{error}</p> : null}
      {sale ? (
        <InvoiceDocument sale={sale} payments={payments} format={format} />
      ) : error ? null : (
        <p className="px-4 text-sm text-neutral-500">Loading invoice…</p>
      )}
    </div>
  );
}
