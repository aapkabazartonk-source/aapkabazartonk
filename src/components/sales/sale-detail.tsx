"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import type { PaymentRecord, SaleRecord } from "@/types/billing";

function paperLabel(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "58mm" || normalized === "58") return "58mm";
  if (normalized === "a4") return "A4";
  if (normalized === "6x4") return "6×4";
  if (normalized === "80mm" || normalized === "80") return "80mm";
  return "80mm";
}

export function SaleDetail({ saleId }: { saleId: string }) {
  const [sale, setSale] = useState<SaleRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ data: { sale: SaleRecord; payments: PaymentRecord[] } }>(`/api/sales/${saleId}`)
      .then((response) => {
        if (cancelled) return;
        setSale(response.data.sale);
        setPayments(response.data.payments);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiClientError ? error.message : "Could not load this sale.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading invoice…</p>;
  if (!sale) return <p className="text-sm text-muted-foreground">This sale could not be found.</p>;

  const paper = paperLabel(sale.invoiceSnapshot?.paperSize);

  return (
    <div>
      <PageHeader
        title={sale.invoiceNumber}
        description={`${sale.invoiceType === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply"} · ${sale.saleNumber} · ${paper}`}
        actions={
          <>
            <Badge variant={sale.paymentStatus === "PAID" ? "success" : sale.paymentStatus === "PARTIAL" ? "warning" : "destructive"}>
              {sale.paymentStatus === "PAID" ? "Paid" : sale.paymentStatus === "PARTIAL" ? "Partial" : "Unpaid"}
            </Badge>
            <Button asChild variant="outline">
              <Link href="/dashboard/sales">Back to sales</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/invoice/${sale._id}?autoprint=1`} target="_blank">
            Print {paper}
          </Link>
        </Button>
        <Button asChild className="bg-purple text-purple-foreground hover:bg-purple/90">
          <a href={`/api/invoices/${sale._id}?format=pdf`} target="_blank" rel="noreferrer">
            Download PDF
          </a>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white p-4">
        <InvoiceDocument sale={sale} payments={payments} />
      </div>
    </div>
  );
}
