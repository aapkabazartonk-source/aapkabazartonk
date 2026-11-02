"use client";

import { useCallback, useEffect, useMemo, useState, useEffectEvent } from "react";
import {
  FolderTree,
  ImageIcon,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { CategoryFormSheet } from "@/components/categories/category-form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatNumber } from "@/lib/utils";
import type { CategoryFormValues } from "@/lib/validators/category";
import type {
  CategoryListResponse,
  CategoryRecord,
} from "@/types/catalog";

function parentName(category: CategoryRecord) {
  if (!category.parentCategory) return "—";
  if (typeof category.parentCategory === "string") return "—";
  return category.parentCategory.name;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function CategoriesManager() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [items, setItems] = useState<CategoryRecord[]>([]);
  const [parentOptions, setParentOptions] = useState<
    { _id: string; name: string }[]
  >([]);
  const [stats, setStats] = useState({
    totalCategories: 0,
    activeCategories: 0,
    totalProducts: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        status,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetchJson<CategoryListResponse>(
        `/api/categories?${params.toString()}`,
      );
      setItems(response.data);
      setPagination(response.pagination);
      setStats(response.stats);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Failed to load categories.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status]);

  const loadParentOptions = useCallback(async () => {
    try {
      const response = await fetchJson<{ data: CategoryRecord[] }>(
        "/api/categories?flat=true&status=active",
      );
      setParentOptions(
        response.data.map((item) => ({ _id: item._id, name: item.name })),
      );
    } catch {
      // Parent dropdown can stay empty; form still works for top-level categories.
    }
  }, []);

  const onLoad = useEffectEvent(() => {
    void loadCategories();
  });

  useEffect(() => {
    onLoad();
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    void loadParentOptions();
  }, [loadParentOptions]);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (category: CategoryRecord) => {
    setMode("edit");
    setEditing(category);
    setSheetOpen(true);
  };

  const handleSubmit = async (values: CategoryFormValues) => {
    setSubmitting(true);
    try {
      if (mode === "create") {
        await fetchJson("/api/categories", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("Category created.");
      } else if (editing) {
        await fetchJson(`/api/categories/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Category updated.");
      }
      setSheetOpen(false);
      await Promise.all([loadCategories(), loadParentOptions()]);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save category.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchJson(`/api/categories/${deleteTarget._id}`, {
        method: "DELETE",
      });
      toast.success("Category deleted.");
      setDeleteTarget(null);
      await Promise.all([loadCategories(), loadParentOptions()]);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not delete category.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = useMemo(
    () => Boolean(debouncedSearch) || status !== "all",
    [debouncedSearch, status],
  );

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Group products into clear categories for browsing, reporting, and POS filters."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SimpleStatCard
          label="Total categories"
          value={formatNumber(stats.totalCategories)}
          description="All categories in your catalog"
          icon={Tags}
          index={0}
        />
        <SimpleStatCard
          label="Active categories"
          value={formatNumber(stats.activeCategories)}
          description="Available for product assignment"
          icon={FolderTree}
          index={1}
        />
        <SimpleStatCard
          label="Total products"
          value={formatNumber(stats.totalProducts)}
          description="Across every category"
          icon={Package}
          index={2}
        />
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search categories…"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full rounded-xl lg:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={hasFilters ? "No categories match your filters" : "No categories yet"}
              description={
                hasFilters
                  ? "Try clearing search or status filters to see more results."
                  : "Create your first category to start organizing products."
              }
              action={
                !hasFilters ? (
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Add Category
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Description
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Parent
                      </TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden xl:table-cell">
                        Created
                      </TableHead>
                      <TableHead className="w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((category) => (
                      <TableRow key={category._id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                              {category.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={category.image}
                                  alt={category.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {category.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                /{category.slug}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] truncate text-muted-foreground md:table-cell">
                          {category.description || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {parentName(category)}
                        </TableCell>
                        <TableCell>
                          {formatNumber(category.productCount ?? 0)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              category.isActive ? "success" : "secondary"
                            }
                          >
                            {category.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground xl:table-cell">
                          {formatDate(category.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(category)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(category)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <CategoryFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={mode}
        initialData={editing}
        parentOptions={parentOptions}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete category?"
        description={
          deleteTarget
            ? `This will permanently delete "${deleteTarget.name}". Categories with products or subcategories cannot be deleted.`
            : ""
        }
        confirming={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
