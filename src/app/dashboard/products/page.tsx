import type { Metadata } from "next";
import { ProductsManager } from "@/components/products/products-manager";

export const metadata: Metadata = {
  title: "Products",
};

export default function ProductsPage() {
  return <ProductsManager />;
}
