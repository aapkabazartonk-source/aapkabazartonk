"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface ReceiptData {
  supplierName: string;
  paymentNumber: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string;
  unallocatedAmount: number;
  notes?: string;
}

interface SupplierPaymentReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptData | null;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
};

export function SupplierPaymentReceipt({
  open,
  onOpenChange,
  receipt,
}: SupplierPaymentReceiptProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md print:shadow-none">
        <DialogHeader>
          <DialogTitle>Payment receipt</DialogTitle>
          <DialogDescription>
            Supplier payment confirmation for your records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Receipt No.</span>
            <span className="font-mono font-medium">{receipt.paymentNumber}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Supplier</span>
            <span className="font-medium">{receipt.supplierName}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Date</span>
            <span>
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
              }).format(new Date(receipt.paymentDate))}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Method</span>
            <span>
              {METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}
            </span>
          </div>
          {receipt.referenceNumber ? (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-xs">{receipt.referenceNumber}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 border-t border-border pt-3 text-base">
            <span className="font-semibold">Amount paid</span>
            <span className="font-semibold">
              {formatCurrency(receipt.amount)}
            </span>
          </div>
          {receipt.unallocatedAmount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Includes advance (unallocated):{" "}
              {formatCurrency(receipt.unallocatedAmount)}
            </p>
          ) : null}
          {receipt.notes ? (
            <p className="text-xs text-muted-foreground">{receipt.notes}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
