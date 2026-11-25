"use client";

import { useCallback, useEffect, useState, useEffectEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormSheet } from "@/components/customers/customer-form-sheet";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { CustomerFormValues } from "@/lib/validators/customer";
import type {
  CustomerDetailResponse,
  CustomerPurchaseRecord,
  CustomerRecord,
} from "@/types/customers";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function paymentBadge(status: string) {
  if (status === "PAID") return <Badge variant="success">Paid</Badge>;
  if (status === "PARTIAL") return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="destructive">Unpaid</Badge>;
}

export function CustomerDetail({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [customer, setCustomer] = useState<
    (CustomerRecord & {
      stats: {
        totalPurchases: number;
        totalAmountSpent: number;
        averagePurchaseValue: number;
        lastPurchaseAt: string | null;
      };
    }) | null
  >(null);
  const [purchases, setPurchases] = useState<CustomerPurchaseRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      const response = await fetchJson<CustomerDetailResponse>(
        `/api/customers/${customerId}?${params.toString()}`,
      );
      setCustomer(response.data);
      setPurchases(response.data.purchases.data);
      setPagination(response.data.purchases.pagination);
    } catch (error) {
      setCustomer(null);
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not load customer.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId, page]);

  const onLoad = useEffectEvent(() => {
    void load();
  });

  useEffect(() => {
    onLoad();
  }, [customerId, page]);

  async function handleSubmit(values: CustomerFormValues) {
    setSubmitting(true);
    try {
      await fetchJson(`/api/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      toast.success("Customer updated");
      setSheetOpen(false);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not update customer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !customer) {
    return <p className="text-sm text-muted-foreground">Loading customer…</p>;
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Customer not found.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/customers">Back to customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={`${customer.phone}${customer.email ? ` · ${customer.email}` : ""}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/customers">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button onClick={() => setSheetOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Profile</h2>
              <Badge variant={customer.isActive ? "success" : "secondary"}>
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">
                {customer.customerType === "BUSINESS" ? "Business" : "Individual"}
              </Badge>
            </div>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Mobile</dt>
                <dd className="font-medium">{customer.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{customer.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="font-medium">
                  {[customer.address, customer.city, customer.state, customer.pincode]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">GSTIN</dt>
                <dd className="font-medium">{customer.gstin || "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <SimpleStatCard
            label="Completed purchases"
            value={formatNumber(customer.stats.totalPurchases)}
            index={0}
          />
          <SimpleStatCard
            label="Total amount spent"
            value={formatCurrency(customer.stats.totalAmountSpent)}
            index={1}
          />
          <SimpleStatCard
            label="Average purchase"
            value={formatCurrency(customer.stats.averagePurchaseValue)}
            index={2}
          />
          <SimpleStatCard
            label="Last purchase"
            value={formatDate(customer.stats.lastPurchaseAt)}
            index={3}
          />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <h2 className="font-semibold">Purchase history</h2>
          <p className="text-sm text-muted-foreground">
            Completed sales only. Cancelled and draft bills are excluded. Returns
            are not recorded in this system.
          </p>
          {purchases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No completed purchases yet.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total amount</TableHead>
                    <TableHead>Payment status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((sale) => (
                    <TableRow key={sale._id}>
                      <TableCell className="font-medium">
                        {sale.invoiceNumber}
                      </TableCell>
                      <TableCell>{formatDate(sale.date)}</TableCell>
                      <TableCell>{sale.itemsCount}</TableCell>
                      <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                      <TableCell>{paymentBadge(sale.paymentStatus)}</TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/sales/${sale._id}`}>
                            View invoice
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <CustomerFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="edit"
        initialData={customer}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
