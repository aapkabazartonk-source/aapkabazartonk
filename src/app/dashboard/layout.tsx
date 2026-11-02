import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return <AppShell>{children}</AppShell>;
}
