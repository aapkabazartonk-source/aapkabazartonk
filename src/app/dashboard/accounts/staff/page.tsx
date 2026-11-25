import type { Metadata } from "next";
import { StaffManager } from "@/components/accounts/staff-manager";

export const metadata: Metadata = {
  title: "Staff & Salaries",
};

export default function StaffPage() {
  return <StaffManager />;
}
