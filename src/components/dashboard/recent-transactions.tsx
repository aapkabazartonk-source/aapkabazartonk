"use client";

import Link from "next/link";
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
import type { DashboardRecentSale } from "@/types/dashboard";

interface RecentTransactionsProps {
  data: DashboardRecentSale[];
  loading?: boolean;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function RecentTransactions({
  data,
  loading = false,
}: RecentTransactionsProps) {
  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Recent sales</CardTitle>
          <CardDescription>Latest completed invoices</CardDescription>
        </div>
        <Link
          href="/dashboard/sales"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-0">
        {loading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading sales…</p>
        ) : data.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No completed sales yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden md:table-cell">Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((sale) => (
                <TableRow key={sale.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={sale.href} className="block min-w-0">
                      <div className="font-mono text-sm font-medium">
                        {sale.invoiceNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(sale.createdAt)}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={sale.href}>{sale.paymentMethod}</Link>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Link href={sale.href}>{formatCurrency(sale.grandTotal)}</Link>
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
