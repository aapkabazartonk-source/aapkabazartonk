"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SUPPLIER_PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import {
  supplierPaymentCreateSchema,
  type SupplierPaymentCreateValues,
} from "@/lib/validators/supplier-payment";

interface SupplierPaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName: string;
  outstanding: number;
  submitting: boolean;
  onSubmit: (values: SupplierPaymentCreateValues) => Promise<void>;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
};

export function SupplierPaymentSheet({
  open,
  onOpenChange,
  supplierName,
  outstanding,
  submitting,
  onSubmit,
}: SupplierPaymentSheetProps) {
  const form = useForm<SupplierPaymentCreateValues>({
    resolver: zodResolver(supplierPaymentCreateSchema) as never,
    defaultValues: {
      amount: outstanding > 0 ? outstanding : 0,
      paymentMethod: "CASH",
      paymentDate: new Date(),
      referenceNumber: "",
      notes: "",
      allowAdvance: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      amount: outstanding > 0 ? Number(outstanding.toFixed(2)) : 0,
      paymentMethod: "CASH",
      paymentDate: new Date(),
      referenceNumber: "",
      notes: "",
      allowAdvance: false,
    });
  }, [open, outstanding, form]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>Record payment</SheetTitle>
          <SheetDescription>
            Pay {supplierName}. Outstanding payable:{" "}
            {formatCurrency(Math.max(0, outstanding))}.
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-5 p-4 sm:p-6"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0.01}
              step="0.01"
              {...form.register("amount")}
            />
            {form.formState.errors.amount ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Controller
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {METHOD_LABELS[method] ?? method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-date">Payment date</Label>
            <Input
              id="pay-date"
              type="date"
              value={
                form.watch("paymentDate")
                  ? new Date(form.watch("paymentDate") as Date)
                      .toISOString()
                      .slice(0, 10)
                  : ""
              }
              onChange={(e) =>
                form.setValue(
                  "paymentDate",
                  e.target.value ? new Date(e.target.value) : new Date(),
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-ref">Reference number</Label>
            <Input
              id="pay-ref"
              placeholder="UPI / cheque / transfer ref"
              {...form.register("referenceNumber")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea id="pay-notes" rows={3} {...form.register("notes")} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Allow advance</p>
              <p className="text-xs text-muted-foreground">
                Required if amount exceeds outstanding purchase balances.
                Excess stays unallocated.
              </p>
            </div>
            <Controller
              control={form.control}
              name="allowAdvance"
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Record payment"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
