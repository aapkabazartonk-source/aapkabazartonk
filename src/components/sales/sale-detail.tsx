"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { InvoiceDocument, type InvoicePaper } from "@/components/billing/invoice-document";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import type { PaymentRecord, SaleRecord } from "@/types/billing";

export function SaleDetail({ saleId }: { saleId: string }) {
  const [sale, setSale] = useState<SaleRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [format, setFormat] = useState<InvoicePaper>("a4");
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

  return (
    <div>
      <PageHeader
        title={sale.invoiceNumber}
        description={`${sale.invoiceType === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply"} · ${sale.saleNumber}`}
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
        {(["58", "80", "a4"] as InvoicePaper[]).map((size) => (
          <Button key={size} type="button" variant={format === size ? "default" : "outline"} onClick={() => setFormat(size)}>
            {size === "a4" ? "A4" : `${size}mm`}
          </Button>
        ))}
        <Button asChild variant="outline">
          <Link href={`/invoice/${sale._id}?format=${format}&autoprint=1`} target="_blank">
            Print
          </Link>
        </Button>
        <Button asChild className="bg-[#128C7E] text-white hover:bg-[#075E54]">
          <a href={`/api/invoices/${sale._id}?format=pdf`} target="_blank" rel="noreferrer">
            Download PDF
          </a>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white p-4">
        <InvoiceDocument sale={sale} payments={payments} format={format} />
      </div>
    </div>
  );
}
