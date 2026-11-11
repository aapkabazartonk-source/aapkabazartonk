"use client";

import { useCallback, useEffect, useState, useEffectEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { SupplierPaymentSheet } from "@/components/suppliers/supplier-payment-sheet";
import { SupplierPaymentReceipt } from "@/components/suppliers/supplier-payment-receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { SupplierPaymentCreateValues } from "@/lib/validators/supplier-payment";
import type { SupplierLedgerResponse } from "@/types/suppliers";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function SupplierLedgerView({ supplierId }: { supplierId: string }) {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<SupplierLedgerResponse | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<{
    supplierName: string;
    paymentNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    referenceNumber?: string;
    unallocatedAmount: number;
    notes?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      const response = await fetchJson<SupplierLedgerResponse>(
        `/api/suppliers/${supplierId}/ledger?${params.toString()}`,
      );
      setLedger(response);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load ledger.",
      );
    } finally {
      setLoading(false);
    }
  }, [supplierId, page]);

  const onLoad = useEffectEvent(() => {
    void load();
  });

  useEffect(() => {
    onLoad();
  }, [supplierId, page]);

  async function handlePayment(values: SupplierPaymentCreateValues) {
    setPaying(true);
    try {
      const response = await fetchJson<{
        data: {
          receipt: {
            paymentNumber: string;
            amount: number;
            paymentMethod: string;
            paymentDate: string;
            referenceNumber?: string;
            unallocatedAmount: number;
            notes?: string;
          };
        };
      }>(`/api/suppliers/${supplierId}/payments`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Payment recorded");
      setReceipt({
        supplierName: ledger?.supplier.name ?? "Supplier",
        ...response.data.receipt,
      });
      setPaymentOpen(false);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not record payment.",
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ledger?.supplier.name ?? "Supplier ledger"}
        description="Immutable payable ledger. Positive balance means amount payable to supplier."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/suppliers">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button onClick={() => setPaymentOpen(true)}>
              <Banknote className="h-4 w-4" />
              Record payment
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SimpleStatCard
          label="Opening balance"
          value={formatCurrency(ledger?.supplier.openingBalance ?? 0)}
          index={0}
        />
        <SimpleStatCard
          label="Outstanding payable"
          value={formatCurrency(ledger?.outstanding ?? 0)}
          index={1}
        />
        <SimpleStatCard
          label="Status"
          value={ledger?.supplier.isActive ? "Active" : "Inactive"}
          description={ledger?.supplier.phone}
          index={2}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <p className="text-sm font-medium">Ledger sign convention</p>
          <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <li>
              <span className="font-medium text-foreground">Debit:</span>{" "}
              {ledger?.convention.debit ?? "Increases payable"}
            </li>
            <li>
              <span className="font-medium text-foreground">Credit:</span>{" "}
              {ledger?.convention.credit ?? "Decreases payable"}
            </li>
            <li>
              <span className="font-medium text-foreground">Positive:</span>{" "}
              {ledger?.convention.positiveBalance ??
                "Amount payable to supplier"}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Purchase returns / adjustments are not supported in this phase.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ledger?.data ?? []).map((entry) => (
                      <TableRow key={entry._id}>
                        <TableCell>{formatDate(entry.entryDate)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{entry.entryType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.referenceNumber || "—"}
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(entry.runningBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!ledger?.data?.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No ledger entries yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
              {ledger ? (
                <div className="mt-4">
                  <PaginationControls
                    page={ledger.pagination.page}
                    totalPages={ledger.pagination.totalPages}
                    total={ledger.pagination.total}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <SupplierPaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        supplierName={ledger?.supplier.name ?? ""}
        outstanding={ledger?.outstanding ?? 0}
        submitting={paying}
        onSubmit={handlePayment}
      />

      <SupplierPaymentReceipt
        open={Boolean(receipt)}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
        receipt={receipt}
      />
    </div>
  );
}
