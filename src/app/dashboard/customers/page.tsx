import type { Metadata } from "next";
import { CustomersManager } from "@/components/customers/customers-manager";

export const metadata: Metadata = {
  title: "Customers",
};

export default function CustomersPage() {
  return <CustomersManager />;
}
