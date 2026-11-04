"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatCurrency } from "@/lib/utils";
import type { SalePaymentStatus, SaleRecord } from "@/types/billing";

type SalesResponse = {
  data: SaleRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: {
    paid: number;
    partial: number;
    unpaid: number;
    totalBilled: number;
    collected: number;
    due: number;
  };
};

function statusBadge(status: SalePaymentStatus) {
  if (status === "PAID") return <Badge variant="success">Paid</Badge>;
  if (status === "PARTIAL") return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="destructive">Unpaid</Badge>;
}

export function SalesManager() {
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SalesResponse | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const response = await fetchJson<SalesResponse>(`/api/sales?${params.toString()}`);
    setResult(response);
  }, [page, search, paymentStatus, from, to]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      load()
        .catch((error) => {
          if (!cancelled) {
            toast.error(error instanceof ApiClientError ? error.message : "Could not load sales.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Completed bills, payment status, and invoice reprints."
        actions={
          <Button asChild className="bg-[#128C7E] text-white hover:bg-[#075E54]">
            <Link href="/dashboard/billing">New bill</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SimpleStatCard label="Billed in view" value={formatCurrency(result?.stats.totalBilled ?? 0)} />
        <SimpleStatCard label="Collected in view" value={formatCurrency(result?.stats.collected ?? 0)} />
        <SimpleStatCard label="Balance due in view" value={formatCurrency(result?.stats.due ?? 0)} />
      </div>
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Invoice, customer, SKU"
            className="h-11"
          />
          <Select
            value={paymentStatus}
            onValueChange={(value) => {
              setPage(1);
              setPaymentStatus(value);
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="h-11" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} aria-label="From date" />
          <Input type="date" className="h-11" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} aria-label="To date" />
        </div>
      </Card>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading sales…</p>
      ) : !result || result.data.length === 0 ? (
        <EmptyState icon={Receipt} title="No sales yet" description="Completed bills from the POS will show up here." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((sale) => (
                <TableRow key={sale._id}>
                  <TableCell>
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.invoiceType === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply"}
                    </p>
                  </TableCell>
                  <TableCell>{sale.invoiceSnapshot?.customerName || "Walk-in customer"}</TableCell>
                  <TableCell>{new Date(sale.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                  <TableCell>{formatCurrency(sale.grandTotal)}</TableCell>
                  <TableCell>{statusBadge(sale.paymentStatus)}</TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/sales/${sale._id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls
            page={result.pagination.page}
            totalPages={result.pagination.totalPages}
            total={result.pagination.total}
            onPageChange={setPage}
          />
        </Card>
      )}
    </div>
  );
}
