import type { Metadata } from "next";
import { CustomerDetail } from "@/components/customers/customer-detail";

export const metadata: Metadata = {
  title: "Customer details",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <CustomerDetail customerId={id} />;
}
