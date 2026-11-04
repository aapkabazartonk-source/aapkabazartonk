export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface CategoryRef {
  _id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
}

export interface CategoryRecord {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  parentCategory: CategoryRef | string | null;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRecord {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  category: CategoryRef | string;
  subcategory: CategoryRef | string | null;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  unit: string;
  hsn?: string;
  gstRate?: number;
  images: string[];
  isActive: boolean;
  stockStatus?: StockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CategoryListResponse {
  data: CategoryRecord[];
  pagination: PaginationMeta;
  stats: {
    totalCategories: number;
    activeCategories: number;
    totalProducts: number;
  };
}

export interface ProductListResponse {
  data: ProductRecord[];
  pagination: PaginationMeta;
  stats: {
    totalProducts: number;
    activeProducts: number;
    lowStockProducts: number;
    totalInventoryValue: number;
  };
}
