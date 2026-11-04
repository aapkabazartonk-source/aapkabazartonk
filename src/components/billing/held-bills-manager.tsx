"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";

type HeldBill = {
  _id: string;
  holdNumber: string;
  customerName: string;
  itemCount: number;
  notes: string;
  createdAt: string;
  cartItems: Array<{ productName: string; quantity: number }>;
};

export function HeldBillsManager() {
  const [bills, setBills] = useState<HeldBill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetchJson<{ data: HeldBill[] }>("/api/pos/held");
    setBills(response.data);
  }, []);

  useEffect(() => {
    load()
      .catch((error) => {
        toast.error(error instanceof ApiClientError ? error.message : "Could not load held bills.");
      })
      .finally(() => setLoading(false));
  }, [load]);

  const discard = async (id: string) => {
    try {
      await fetchJson(`/api/pos/held/${id}`, { method: "DELETE" });
      toast.success("Held bill discarded.");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not discard that bill.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Held bills"
        description="Parked carts stay here until you resume them. Stock is not reserved."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/billing">Back to billing</Link>
          </Button>
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading held bills…</p>
      ) : bills.length === 0 ? (
        <EmptyState icon={PauseCircle} title="No held bills" description="Use Hold on the billing screen to park a cart." />
      ) : (
        <div className="grid gap-3">
          {bills.map((bill) => (
            <Card key={bill._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{bill.holdNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {bill.customerName} · {bill.cartItems.length} lines ·{" "}
                  {new Date(bill.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="mt-1 text-sm">
                  {bill.cartItems.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
                </p>
                {bill.notes ? <p className="text-xs text-muted-foreground">{bill.notes}</p> : null}
              </div>
              <div className="flex gap-2">
                <Button asChild className="h-11 bg-[#128C7E] text-white hover:bg-[#075E54]">
                  <Link href={`/dashboard/billing?held=${bill._id}`}>Resume</Link>
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => void discard(bill._id)}>
                  Discard
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
