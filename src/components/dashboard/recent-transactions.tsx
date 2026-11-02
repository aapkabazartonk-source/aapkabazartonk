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
import type { OrderStatus, Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface RecentTransactionsProps {
  data: Transaction[];
}

const statusVariant: Record<
  OrderStatus,
  "success" | "warning" | "destructive" | "purple"
> = {
  completed: "success",
  pending: "purple",
  cancelled: "destructive",
  refunded: "warning",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RecentTransactions({ data }: RecentTransactionsProps) {
  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Latest POS and order activity</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>
                  <div className="font-medium">{txn.orderId}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(txn.createdAt)} · {txn.items} items
                  </div>
                </TableCell>
                <TableCell>{txn.customer}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {txn.paymentMethod}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[txn.status]} className="capitalize">
                    {txn.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(txn.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
