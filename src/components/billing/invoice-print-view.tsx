"use client";

import { useEffect, useMemo, useState } from "react";
import {
  InvoiceDocument,
  type InvoicePaper,
} from "@/components/billing/invoice-document";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import type { PaymentRecord, SaleRecord } from "@/types/billing";

const PAPER_PAGE: Record<InvoicePaper, string> = {
  "58mm": "58mm auto",
  "80mm": "80mm auto",
  A4: "A4",
  "6x4": "4in 6in",
};

function resolvePaper(value?: string | null): InvoicePaper {
  if (value === "58mm" || value === "80mm" || value === "A4" || value === "6x4") {
    return value;
  }
  return "80mm";
}

export function InvoicePrintView({ invoiceId }: { invoiceId: string }) {
  const [sale, setSale] = useState<SaleRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ data: { sale: SaleRecord; payments: PaymentRecord[] } }>(
      `/api/invoices/${invoiceId}`,
    )
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

  const paper = useMemo(
    () => resolvePaper(sale?.invoiceSnapshot?.paperSize),
    [sale],
  );

  useEffect(() => {
    if (!sale) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoprint") !== "1") return;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [sale]);

  return (
    <div className="min-h-screen bg-neutral-100 py-6">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } @page { size: ${PAPER_PAGE[paper]}; margin: 4mm; } }`}</style>
      <div className="no-print mx-auto mb-4 flex w-full max-w-md flex-wrap items-center gap-2 px-4">
        <p className="mr-auto text-sm text-neutral-600">Invoice size {paper}</p>
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => window.print()}
        >
          Print
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/invoices/${invoiceId}?format=pdf`}>PDF</a>
        </Button>
      </div>
      {error ? <p className="px-4 text-sm">{error}</p> : null}
      {sale ? (
        <InvoiceDocument sale={sale} payments={payments} format={paper} />
      ) : error ? null : (
        <p className="px-4 text-sm text-neutral-500">Loading invoice…</p>
      )}
    </div>
  );
}
