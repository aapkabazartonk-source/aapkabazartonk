"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ImageIcon,
  Minus,
  Pause,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  CheckoutDialog,
  draftsToPayments,
  type TenderDraft,
} from "@/components/billing/checkout-dialog";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatCurrency } from "@/lib/utils";
import type {
  PaymentRecord,
  PosBillingPreferences,
  PosBusiness,
  PosCategory,
  PosProduct,
  SaleQuote,
  SaleRecord,
  TenderMethod,
} from "@/types/billing";

type CartLine = {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  unitPrice: number;
  gstRate: number;
  hsn: string;
  currentStock: number;
  quantity: number;
  discount: number;
};

function qtyStep(unit: string) {
  return unit === "kg" || unit === "gram" || unit === "litre" || unit === "ml" || unit === "metre"
    ? 0.1
    : 1;
}

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function PosScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef("");
  const confirmRef = useRef<() => void>(() => undefined);
  const resumedHold = useRef<string | null>(null);

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [business, setBusiness] = useState<PosBusiness | null>(null);
  const [preferences, setPreferences] = useState<PosBillingPreferences | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [billDiscount, setBillDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [heldCartId, setHeldCartId] = useState<string | null>(null);
  const [quote, setQuote] = useState<SaleQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [payments, setPayments] = useState<TenderDraft[]>([]);
  const [allowCredit, setAllowCredit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<{ sale: SaleRecord; payments: PaymentRecord[] } | null>(null);

  const billDiscountNumber = Number(billDiscount) || 0;

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (categoryId !== "all") params.set("category", categoryId);
    const response = await fetchJson<{
      data: PosProduct[];
      categories: PosCategory[];
      business: PosBusiness;
      preferences?: PosBillingPreferences;
    }>(`/api/pos/products?${params.toString()}`);
    setProducts(response.data);
    setCategories(response.categories);
    setBusiness(response.business);
    if (response.preferences) {
      setPreferences(response.preferences);
      const defaultMethod =
        response.preferences.billing.defaultPaymentMethod ?? "CASH";
      setPayments((current) =>
        current.length
          ? current
          : [
              {
                id: crypto.randomUUID(),
                method: defaultMethod,
                amount: "",
                reference: "",
              },
            ],
      );
    }
  }, [search, categoryId]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      loadProducts()
        .catch((error) => {
          if (!cancelled) {
            toast.error(error instanceof ApiClientError ? error.message : "Could not load products.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadProducts]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addProduct = useCallback((product: PosProduct) => {
    const stock = Number(product.currentStock) || 0;
    if (stock <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }
    const existing = cart.find((line) => line.productId === product._id);
    const step = qtyStep(product.unit);
    const base = existing?.quantity ?? 0;
    let next = roundQty(base === 0 ? Math.min(step, stock) : base + step);
    if (base === 0 && stock < step) next = roundQty(stock);
    if (next > stock) {
      toast.error(`Only ${stock} ${product.unit} available for ${product.name}.`);
      return;
    }
    const line: CartLine = {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      unit: product.unit,
      unitPrice: product.sellingPrice,
      gstRate: product.gstRate ?? 0,
      hsn: product.hsn ?? "",
      currentStock: stock,
      quantity: next,
      discount: existing?.discount ?? 0,
    };
    setSelectedId(product._id);
    setCart((current) => {
      const found = current.find((item) => item.productId === product._id);
      if (!found) return [...current, line];
      return current.map((item) => (item.productId === product._id ? { ...line, discount: found.discount } : item));
    });
  }, [cart]);

  useEffect(() => {
    const held = searchParams.get("held");
    if (!held || resumedHold.current === held) return;
    resumedHold.current = held;
    const run = async () => {
      try {
        const response = await fetchJson<{
          data: {
            heldCartId: string;
            billDiscount: number;
            notes: string;
            items: Array<{
              productId: string;
              quantity: number;
              discount: number;
              available: boolean;
              productName: string;
              product: {
                name: string;
                sku: string;
                barcode: string;
                unit: string;
                hsn: string;
                gstRate: number;
                sellingPrice: number;
                currentStock: number;
                isActive: boolean;
              } | null;
            }>;
          };
        }>(`/api/pos/held/${held}/resume`, { method: "POST" });
        const next: CartLine[] = [];
        for (const item of response.data.items) {
          if (!item.product || !item.available) {
            toast.error(`${item.productName} is no longer available.`);
            continue;
          }
          const quantity = Math.min(item.quantity, item.product.currentStock);
          if (quantity <= 0) {
            toast.error(`${item.product.name} is out of stock.`);
            continue;
          }
          if (quantity < item.quantity) {
            toast.error(`Only ${quantity} ${item.product.unit} left for ${item.product.name}.`);
          }
          next.push({
            productId: item.productId,
            name: item.product.name,
            sku: item.product.sku,
            barcode: item.product.barcode,
            unit: item.product.unit,
            unitPrice: item.product.sellingPrice,
            gstRate: item.product.gstRate ?? 0,
            hsn: item.product.hsn ?? "",
            currentStock: item.product.currentStock,
            quantity,
            discount: item.discount,
          });
        }
        setCart(next);
        setHeldCartId(response.data.heldCartId);
        setBillDiscount(String(response.data.billDiscount ?? 0));
        setNotes(response.data.notes ?? "");
        setSelectedId(next[0]?.productId ?? null);
        router.replace("/dashboard/billing");
        toast.success("Held bill loaded. Prices will be recalculated at checkout.");
      } catch (error) {
        toast.error(error instanceof ApiClientError ? error.message : "Could not resume that bill.");
      }
    };
    void run();
  }, [searchParams, router]);

  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      setQuoteError("");
      setQuoting(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const payload = {
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discount: Number(line.discount) || 0,
        })),
        billDiscount: billDiscountNumber,
        customerId: null,
        notes,
        payments: checkoutOpen ? draftsToPayments(payments) : [],
        allowCredit: checkoutOpen ? allowCredit : true,
        settle: checkoutOpen,
      };
      setQuoting(true);
      fetchJson<{ data: SaleQuote }>("/api/pos/quote", {
        method: "POST",
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then((response) => {
          setQuote(response.data);
          setQuoteError("");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (error instanceof Error && error.name === "AbortError") return;
          setQuoteError(error instanceof ApiClientError ? error.message : "Could not calculate the bill.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoting(false);
        });
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [cart, billDiscountNumber, notes, payments, allowCredit, checkoutOpen]);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedId(null);
    setBillDiscount("0");
    setNotes("");
    setHeldCartId(null);
    setQuote(null);
    setQuoteError("");
  }, []);

  const holdBill = useCallback(async () => {
    if (cart.length === 0 || checkoutOpen) return;
    try {
      await fetchJson("/api/pos/hold", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            discount: Number(line.discount) || 0,
          })),
          billDiscount: billDiscountNumber,
          customerId: null,
          notes,
          heldCartId,
        }),
      });
      toast.success(heldCartId ? "Held bill updated." : "Bill held.");
      clearCart();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not hold this bill.");
    }
  }, [cart, checkoutOpen, billDiscountNumber, notes, heldCartId, clearCart]);

  const openCheckout = useCallback(() => {
    if (cart.length === 0 || quoteError) return;
    idempotencyKey.current = crypto.randomUUID();
    setPayments((current) =>
      current.length > 0
        ? current
        : [{ id: crypto.randomUUID(), method: "CASH", amount: "", reference: "" }],
    );
    setCheckoutOpen(true);
  }, [cart.length, quoteError]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setCart((current) => current.filter((line) => line.productId !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = isTextField(event.target);
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === "F4") {
        event.preventDefault();
        void holdBill();
      } else if (event.key === "F8") {
        event.preventDefault();
        if (checkoutOpen) {
          if (!submitting) confirmRef.current();
          return;
        }
        openCheckout();
      } else if (event.key === "Escape") {
        if (checkoutOpen) setCheckoutOpen(false);
        else if (previewOpen) setPreviewOpen(false);
      } else if (event.key === "Delete" && !typing && !checkoutOpen && !previewOpen) {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [holdBill, openCheckout, removeSelected, checkoutOpen, previewOpen, submitting]);

  const quoteByProduct = useMemo(() => {
    const map = new Map<string, SaleQuote["lines"][number]>();
    quote?.lines.forEach((line) => map.set(line.productId, line));
    return map;
  }, [quote]);

  const confirmSale = async () => {
    setSubmitting(true);
    try {
      const response = await fetchJson<{
        data: { sale: SaleRecord; payments: PaymentRecord[]; replayed: boolean };
      }>("/api/pos/checkout", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          heldCartId,
          customerId: null,
          notes,
          billDiscount: billDiscountNumber,
          allowCredit,
          settle: true,
          items: cart.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            discount: Number(line.discount) || 0,
          })),
          payments: draftsToPayments(payments),
        }),
      });
      setCompleted({ sale: response.data.sale, payments: response.data.payments });
      setCheckoutOpen(false);
      setPreviewOpen(true);
      setPayments([]);
      setAllowCredit(false);
      clearCart();
      void loadProducts();
      toast.success(response.data.replayed ? "This checkout was already saved." : "Bill saved.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Checkout failed.");
      void loadProducts();
    } finally {
      setSubmitting(false);
    }
  };
  confirmRef.current = () => {
    void confirmSale();
  };

  const updateQty = (productId: string, quantity: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.productId !== productId) return [line];
        const next = roundQty(quantity);
        if (next <= 0) return [];
        if (next > line.currentStock) {
          toast.error(`Only ${line.currentStock} ${line.unit} available.`);
          return [{ ...line, quantity: line.currentStock }];
        }
        return [{ ...line, quantity: next }];
      }),
    );
  };

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Billing</h1>
          <p className="text-xs text-muted-foreground">
            {business?.storeName || business?.name || "Store"}
            {business?.isGstRegistered
              ? business.pricesIncludeGst
                ? " · GST inclusive"
                : " · GST extra"
              : " · Non-GST"}
            {" · F2 search · F4 hold · F8 pay"}
          </p>
        </div>
        <Button asChild variant="outline" className="h-11">
          <Link href="/dashboard/billing/held">Held bills</Link>
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-0 flex-col gap-3 overflow-hidden p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or SKU"
              className="h-12 pl-10"
              aria-label="Product search"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={categoryId === "all"} onClick={() => setCategoryId("all")}>
              All
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category._id}
                active={categoryId === category._id}
                onClick={() => setCategoryId(category._id)}
              >
                {category.name}
              </FilterChip>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading products…</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active products match this search.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                {products.map((product) => {
                  const stock = Number(product.currentStock) || 0;
                  const imageUrl = product.images?.[0];
                  return (
                    <button
                      key={product._id}
                      type="button"
                      disabled={stock <= 0}
                      onClick={() => addProduct(product)}
                      className="flex min-h-24 flex-col items-start rounded-2xl border border-border bg-card p-3 text-left shadow-[var(--shadow-sm)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="mb-2 aspect-square w-full overflow-hidden rounded-xl bg-secondary">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- product images are Cloudinary or other remote URLs
                          <img
                            src={imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {product.sku}
                        {product.barcode ? ` · ${product.barcode}` : ""}
                      </span>
                      <span className="mt-auto flex w-full items-end justify-between pt-2">
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(product.sellingPrice)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stock} {product.unit}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-border bg-card lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-purple" />
              <h2 className="font-semibold">Cart</h2>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearCart} disabled={cart.length === 0}>
              Clear
            </Button>
          </div>

          <div className="border-b border-border px-4 pb-3">
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              Walk-in customer
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Search and tap a product to start a bill.
              </p>
            ) : (
              cart.map((line) => {
                const priced = quoteByProduct.get(line.productId);
                const selected = selectedId === line.productId;
                return (
                  <div
                    key={line.productId}
                    className={`rounded-2xl border p-3 ${selected ? "border-purple bg-purple-soft" : "border-border"}`}
                    onClick={() => setSelectedId(line.productId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(priced?.unitPrice ?? line.unitPrice)} · {line.currentStock} in stock
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        {priced ? formatCurrency(priced.finalAmount) : "…"}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => updateQty(line.productId, line.quantity - qtyStep(line.unit))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        className="h-11 w-20 text-center"
                        inputMode="decimal"
                        value={String(line.quantity)}
                        onChange={(event) => updateQty(line.productId, Number(event.target.value))}
                        aria-label={`Quantity for ${line.name}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => updateQty(line.productId, line.quantity + qtyStep(line.unit))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Input
                        className="h-11 flex-1"
                        inputMode="decimal"
                        value={String(line.discount)}
                        onChange={(event) =>
                          setCart((current) =>
                            current.map((item) =>
                              item.productId === line.productId
                                ? { ...item, discount: Number(event.target.value) || 0 }
                                : item,
                            ),
                          )
                        }
                        aria-label={`Discount for ${line.name}`}
                        placeholder="Discount ₹"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() =>
                          setCart((current) => current.filter((item) => item.productId !== line.productId))
                        }
                        aria-label={`Remove ${line.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2 border-t border-border p-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="bill-discount" className="shrink-0">
                Bill discount
              </Label>
              <Input
                id="bill-discount"
                className="h-11"
                inputMode="decimal"
                value={billDiscount}
                onChange={(event) => setBillDiscount(event.target.value)}
              />
            </div>
            <Input
              className="h-11"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Note on the bill"
              maxLength={500}
            />
            <Totals quote={quote} quoting={quoting} error={quoteError} />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 border-purple/40 bg-purple-soft text-purple hover:bg-purple-soft/80 hover:text-purple"
                disabled={cart.length === 0}
                onClick={() => void holdBill()}
              >
                <Pause className="h-4 w-4" />
                Hold
              </Button>
              <Button
                type="button"
                className="h-12 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={cart.length === 0 || Boolean(quoteError)}
                onClick={openCheckout}
              >
                Checkout
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        quote={quote}
        quoting={quoting}
        quoteError={checkoutOpen ? quoteError : ""}
        payments={payments}
        onPaymentsChange={setPayments}
        allowCredit={allowCredit}
        onAllowCreditChange={setAllowCredit}
        submitting={submitting}
        onConfirm={() => void confirmSale()}
        enabledPaymentMethods={
          preferences?.billing.enabledPaymentMethods as TenderMethod[] | undefined
        }
        allowCreditSales={preferences?.billing.allowCreditSales !== false}
      />
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice {completed?.sale.invoiceNumber}</DialogTitle>
          </DialogHeader>
          {completed ? (
            <>
              <InvoiceDocument sale={completed.sale} payments={completed.payments} />
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/invoice/${completed.sale._id}?autoprint=1`} target="_blank">
                    Print
                  </Link>
                </Button>
                <Button asChild className="bg-purple text-purple-foreground hover:bg-purple/90">
                  <a href={`/api/invoices/${completed.sale._id}?format=pdf`} target="_blank" rel="noreferrer">
                    Download PDF
                  </a>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
        active
          ? "bg-purple text-purple-foreground shadow-[var(--shadow-sm)]"
          : "bg-muted text-foreground hover:bg-purple-soft/70"
      }`}
    >
      {children}
    </button>
  );
}

function Totals({
  quote,
  quoting,
  error,
}: {
  quote: SaleQuote | null;
  quoting: boolean;
  error: string;
}) {
  const totals = quote?.totals;
  return (
    <div className="space-y-1 text-sm">
      <Line label="Subtotal" value={totals ? formatCurrency(totals.subtotal) : "—"} />
      <Line label="Item discount" value={totals ? formatCurrency(totals.itemDiscount) : "—"} />
      <Line label="Bill discount" value={totals ? formatCurrency(totals.billDiscount) : "—"} />
      <Line label="Tax" value={totals ? formatCurrency(totals.totalTax) : "—"} />
      <div className="mt-1 flex items-center justify-between rounded-xl bg-purple-soft/70 px-3 py-2 text-base font-semibold">
        <span className="text-purple">Total</span>
        <span className="text-purple">
          {totals ? formatCurrency(totals.grandTotal) : quoting ? "Calculating…" : "—"}
        </span>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
