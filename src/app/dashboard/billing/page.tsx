import type { Metadata } from "next";
import { Suspense } from "react";
import { PosScreen } from "@/components/billing/pos-screen";

export const metadata: Metadata = {
  title: "POS Billing",
};

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading billing…</p>}>
      <PosScreen />
    </Suspense>
  );
}
