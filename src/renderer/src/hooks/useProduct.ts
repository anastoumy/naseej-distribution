import { useState, useCallback } from "react";

import { productsController } from "@/lib/controllers";
import type { Product } from "@/types/Global";

// ── Shared types ──────────────────────────────────────────────────────────────

type CreateProductData = Parameters<typeof productsController.create>[0];
type UpdateProductData = Parameters<typeof productsController.update>[0];

// ─────────────────────────────────────────────────────────────────────────────

// ── useProducts — fetch all products ─────────────────────────────────────────

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productsController.getAll();
      if (res.success && res.data) {
        setProducts(res.data);
      } else {
        setError(res.error ?? "Failed to load products");
      }
    } catch {
      setError("Could not reach product service");
    } finally {
      setLoading(false);
    }
  }, []);

  return { products, loading, error, fetch, setProducts };
}

// ── useProduct — fetch a single product by id ─────────────────────────────────

export function useProduct() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await productsController.getById(id);
      if (res.success && res.data) {
        setProduct(res.data);
      } else {
        setError(res.error ?? "Failed to load product");
      }
    } catch {
      setError("Could not reach product service");
    } finally {
      setLoading(false);
    }
  }, []);

  return { product, loading, error, fetch };
}

// ── useCreateProduct ──────────────────────────────────────────────────────────

export function useCreateProduct() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (
      data: CreateProductData,
      options?: {
        onSuccess?: (id: number) => void;
        onError?: (err: string) => void;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await productsController.create(data);
        if (res.success && res.data) {
          options?.onSuccess?.(res.data.id);
          return res.data.id;
        } else {
          const msg = res.error ?? "Failed to create product";
          setError(msg);
          options?.onError?.(msg);
          return null;
        }
      } catch {
        const msg = "Could not reach product service";
        setError(msg);
        options?.onError?.(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { create, loading, error };
}

// ── useUpdateProduct ──────────────────────────────────────────────────────────

export function useUpdateProduct() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (
      data: UpdateProductData,
      options?: {
        onSuccess?: () => void;
        onError?: (err: string) => void;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await productsController.update(data);
        if (res.success) {
          options?.onSuccess?.();
          return true;
        } else {
          const msg = res.error ?? "Failed to update product";
          setError(msg);
          options?.onError?.(msg);
          return false;
        }
      } catch {
        const msg = "Could not reach product service";
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { update, loading, error };
}

// ── useDeleteProduct ──────────────────────────────────────────────────────────

export function useDeleteProduct() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(
    async (
      id: number,
      options?: {
        onSuccess?: () => void;
        onError?: (err: string) => void;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await productsController.delete(id);
        if (res.success) {
          options?.onSuccess?.();
          return true;
        } else {
          const msg = res.error ?? "Failed to delete product";
          setError(msg);
          options?.onError?.(msg);
          return false;
        }
      } catch {
        const msg = "Could not reach product service";
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { remove, loading, error };
}

// ── useProductsCRUD — all operations in one hook ──────────────────────────────
// Convenience hook that combines list state with mutation helpers.
// Mutations that succeed automatically sync the local `products` list
// so you don't need a manual re-fetch after every write.

export function useProductsCRUD() {
  const {
    products,
    loading: listLoading,
    error: listError,
    fetch,
    setProducts,
  } = useProducts();
  const {
    create,
    loading: createLoading,
    error: createError,
  } = useCreateProduct();
  const {
    update,
    loading: updateLoading,
    error: updateError,
  } = useUpdateProduct();
  const {
    remove,
    loading: deleteLoading,
    error: deleteError,
  } = useDeleteProduct();

  // Create + push new product into local list
  const createAndSync = useCallback(
    async (
      data: CreateProductData,
      options?: {
        onSuccess?: (id: number) => void;
        onError?: (err: string) => void;
      },
    ) => {
      const id = await create(data, {
        onSuccess: async (newId) => {
          // Re-fetch the full list so the new record (with server-generated fields) appears
          await fetch();
          options?.onSuccess?.(newId);
        },
        onError: options?.onError,
      });
      return id;
    },
    [create, fetch],
  );

  // Update + patch the local list optimistically
  const updateAndSync = useCallback(
    async (
      data: UpdateProductData,
      options?: { onSuccess?: () => void; onError?: (err: string) => void },
    ) => {
      const ok = await update(data, {
        onSuccess: () => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === data.id
                ? {
                    ...p,
                    ...(data.title !== undefined && { title: data.title }),
                    ...(data.price !== undefined && { price: data.price }),
                    ...(data.wholesale_price !== undefined && {
                      wholesale_price: data.wholesale_price,
                    }),
                    ...(data.category_id !== undefined && {
                      category_id: data.category_id,
                    }),
                    ...(data.supplier_id !== undefined && {
                      supplier_id: data.supplier_id,
                    }),
                    ...(data.purchase_price !== undefined && {
                      purchase_price: data.purchase_price,
                    }),
                    ...(data.taxable !== undefined && { taxable: data.taxable }),
                  }
                : p,
            ),
          );
          options?.onSuccess?.();
        },
        onError: options?.onError,
      });
      return ok;
    },
    [update, setProducts],
  );

  // Delete + remove from local list
  const removeAndSync = useCallback(
    async (
      id: number,
      options?: { onSuccess?: () => void; onError?: (err: string) => void },
    ) => {
      const ok = await remove(id, {
        onSuccess: () => {
          setProducts((prev) => prev.filter((p) => p.id !== id));
          options?.onSuccess?.();
        },
        onError: options?.onError,
      });
      return ok;
    },
    [remove, setProducts],
  );

  return {
    // List
    products,
    fetch,
    listLoading,
    listError,

    // Create
    create: createAndSync,
    createLoading,
    createError,

    // Update
    update: updateAndSync,
    updateLoading,
    updateError,

    // Delete
    remove: removeAndSync,
    deleteLoading,
    deleteError,
  };
}
