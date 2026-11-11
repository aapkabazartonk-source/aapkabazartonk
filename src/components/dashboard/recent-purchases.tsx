"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { DashboardRecentPurchase } from "@/types/dashboard";

interface RecentPurchasesProps {
  data: DashboardRecentPurchase[];
  loading?: boolean;
}

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  RECEIVED: "success",
  DRAFT: "warning",
  CANCELLED: "destructive",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function RecentPurchases({
  data,
  loading = false,
}: RecentPurchasesProps) {
  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Recent purchases</CardTitle>
          <CardDescription>Latest purchase orders and receipts</CardDescription>
        </div>
        <Link
          href="/dashboard/purchases"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-0">
        {loading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            Loading purchases…
          </p>
        ) : data.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No purchases yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Purchase</TableHead>
                <TableHead className="hidden sm:table-cell">Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <Link href={purchase.href} className="block">
                      <div className="font-mono text-sm font-medium">
                        {purchase.purchaseNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(purchase.receivedAt ?? purchase.purchaseDate ?? purchase.createdAt)}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Link href={purchase.href}>{purchase.supplierName}</Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant[purchase.status] ?? "secondary"}
                      className="capitalize"
                    >
                      {purchase.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Link href={purchase.href}>
                      {formatCurrency(purchase.total)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
