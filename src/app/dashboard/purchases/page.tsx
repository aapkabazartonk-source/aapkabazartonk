import type { Metadata } from "next";
import { Suspense } from "react";
import { PurchasesManager } from "@/components/purchases/purchases-manager";

export const metadata: Metadata = {
  title: "Purchases",
};

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading purchases...</div>}>
      <PurchasesManager />
    </Suspense>
  );
}
