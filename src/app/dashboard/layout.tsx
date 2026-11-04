import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading workspace…</div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
