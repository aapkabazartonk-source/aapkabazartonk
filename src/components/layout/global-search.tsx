"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Package,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchHit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: "product" | "sale" | "supplier";
};

type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
};

async function readJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asRecords(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[];
  return [];
}

export function GlobalSearch({
  open,
  onOpenChange,
  initialQuery = "",
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    if (debounced.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      search: debounced,
      page: "1",
      limit: "5",
    });

    void (async () => {
      try {
        const [productsRes, salesRes, suppliersRes] = await Promise.all([
          fetch(`/api/products?${params.toString()}`),
          fetch(`/api/sales?${params.toString()}`),
          fetch(`/api/suppliers?${params.toString()}`),
        ]);

        const [productsPayload, salesPayload, suppliersPayload] =
          await Promise.all([
            readJson(productsRes),
            readJson(salesRes),
            readJson(suppliersRes),
          ]);

        if (cancelled) return;

        const next: SearchHit[] = [];

        for (const product of asRecords(productsPayload)) {
          const id = String(product._id ?? "");
          if (!id) continue;
          next.push({
            id: `product-${id}`,
            title: String(product.name ?? "Product"),
            subtitle: `SKU ${String(product.sku ?? "—")} · Stock ${Number(product.currentStock ?? 0)}`,
            href: `/dashboard/products?search=${encodeURIComponent(String(product.name ?? debounced))}`,
            kind: "product",
          });
        }

        for (const sale of asRecords(salesPayload)) {
          const id = String(sale._id ?? "");
          if (!id) continue;
          const invoice =
            String(sale.invoiceNumber || sale.saleNumber || "").trim() ||
            "Sale";
          next.push({
            id: `sale-${id}`,
            title: invoice,
            subtitle: "Sale / invoice",
            href: `/dashboard/sales/${id}`,
            kind: "sale",
          });
        }

        for (const supplier of asRecords(suppliersPayload)) {
          const id = String(supplier._id ?? "");
          if (!id) continue;
          next.push({
            id: `supplier-${id}`,
            title: String(supplier.name ?? "Supplier"),
            subtitle: String(supplier.phone || supplier.contactPerson || "Supplier"),
            href: `/dashboard/suppliers/${id}`,
            kind: "supplier",
          });
        }

        setHits(next);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const groups = useMemo(() => {
    return {
      products: hits.filter((hit) => hit.kind === "product"),
      sales: hits.filter((hit) => hit.kind === "sale"),
      suppliers: hits.filter((hit) => hit.kind === "supplier"),
    };
  }, [hits]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle className="sr-only">Search store</DialogTitle>
          <DialogDescription className="sr-only">
            Search products, sales, and suppliers
          </DialogDescription>
          <div className="relative">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, invoices, suppliers…"
              className="h-11 border-0 bg-transparent pl-7 shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2 sm:p-3">
          {debounced.length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : hits.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{debounced}”.
            </p>
          ) : (
            <div className="space-y-3">
              <ResultGroup
                title="Products"
                icon={Package}
                items={groups.products}
                onSelect={go}
              />
              <ResultGroup
                title="Sales"
                icon={ShoppingCart}
                items={groups.sales}
                onSelect={go}
              />
              <ResultGroup
                title="Suppliers"
                icon={Truck}
                items={groups.suppliers}
                onSelect={go}
              />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() =>
                  go(
                    `/dashboard/products?search=${encodeURIComponent(debounced)}`,
                  )
                }
              >
                <Search className="h-4 w-4" />
                Search all products for “{debounced}”
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultGroup({
  title,
  icon: Icon,
  items,
  onSelect,
}: {
  title: string;
  icon: typeof Package;
  items: SearchHit[];
  onSelect: (href: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted",
              )}
              onClick={() => onSelect(item.href)}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.subtitle}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
