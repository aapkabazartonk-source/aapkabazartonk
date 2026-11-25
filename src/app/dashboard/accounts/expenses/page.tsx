import type { Metadata } from "next";
import { ExpensesManager } from "@/components/accounts/expenses-manager";

export const metadata: Metadata = {
  title: "Expenses",
};

export default function ExpensesPage() {
  return <ExpensesManager />;
}
