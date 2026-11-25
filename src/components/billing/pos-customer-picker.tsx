"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Loader2, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import type { CustomerOption } from "@/types/customers";

export type PosSelectedCustomer = {
  _id: string;
  name: string;
  phone: string;
};

interface PosCustomerPickerProps {
  selected: PosSelectedCustomer | null;
  onSelect: (customer: PosSelectedCustomer | null) => void;
}

export function PosCustomerPicker({
  selected,
  onSelect,
}: PosCustomerPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "create">("search");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadOptions = useEffectEvent(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        options: "1",
        limit: "12",
      });
      if (query) params.set("search", query);
      const response = await fetchJson<{ data: CustomerOption[] }>(
        `/api/customers?${params.toString()}`,
      );
      setResults(response.data);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not search customers.",
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!open || mode !== "search") return;
    void loadOptions(debounced);
  }, [open, mode, debounced]);

  function resetCreateForm() {
    setName("");
    setPhone("");
    setEmail("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setMode("search");
      setSearch("");
      resetCreateForm();
    }
  }

  async function createCustomer() {
    setCreating(true);
    try {
      const response = await fetchJson<{
        data: { _id: string; name: string; phone: string };
      }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          quick: true,
          name,
          phone,
          email,
        }),
      });
      onSelect({
        _id: response.data._id,
        name: response.data.name,
        phone: response.data.phone,
      });
      toast.success("Customer added");
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not create customer.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="rounded-xl bg-muted/60 px-3 py-2">
        {selected ? (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {selected.name}
              </p>
              <p className="text-xs text-muted-foreground">{selected.phone}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setOpen(true)}
              >
                Change
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onSelect(null)}
                aria-label="Remove customer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setOpen(true)}
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="h-4 w-4" />
              Walk-in Customer
            </span>
            <span className="text-xs font-medium text-primary">Select</span>
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "search" ? "Select customer" : "Add customer"}
            </DialogTitle>
            <DialogDescription>
              Optional. Checkout works without a customer as Walk-in.
            </DialogDescription>
          </DialogHeader>

          {mode === "search" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name or mobile"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {loading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Searching…
                  </p>
                ) : results.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No matching customers.
                  </p>
                ) : (
                  results.map((customer) => (
                    <button
                      key={customer._id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-muted/70"
                      onClick={() => {
                        onSelect({
                          _id: customer._id,
                          name: customer.name,
                          phone: customer.phone,
                        });
                        handleOpenChange(false);
                      }}
                    >
                      <span>
                        <span className="block text-sm font-medium">
                          {customer.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {customer.phone}
                          {customer.email ? ` · ${customer.email}` : ""}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMode("create");
                  if (/^\d[\d\s+\-()]*$/.test(search.trim())) {
                    setPhone(search.trim());
                  } else if (search.trim()) {
                    setName(search.trim());
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                Add new customer
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pos-customer-name">Name *</Label>
                <Input
                  id="pos-customer-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-customer-phone">Mobile *</Label>
                <Input
                  id="pos-customer-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-customer-email">Email</Label>
                <Input
                  id="pos-customer-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMode("search")}
                  disabled={creating}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={creating || !name.trim() || !phone.trim()}
                  onClick={() => {
                    void createCustomer();
                  }}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Save & select"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
