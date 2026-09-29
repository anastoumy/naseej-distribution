import { useState, useCallback } from "react";

import { categoriesController } from "@/lib/controllers";
import type { Category } from "@/types/Global";

// ── Shared types ──────────────────────────────────────────────────────────────

type CreateCategoryData = Parameters<typeof categoriesController.create>[0];
type UpdateCategoryData = Parameters<typeof categoriesController.update>[0];

// ─────────────────────────────────────────────────────────────────────────────

// ── useCategories — fetch all categories ─────────────────────────────────────

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await categoriesController.getAll();
      if (res.success && res.data) {
        setCategories(res.data);
      } else {
        setError(res.error ?? "Failed to load categories");
      }
    } catch {
      setError("Could not reach category service");
    } finally {
      setLoading(false);
    }
  }, []);

  return { categories, loading, error, fetch, setCategories };
}

// ── useCreateCategory ─────────────────────────────────────────────────────────

export function useCreateCategory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (
      data: CreateCategoryData,
      options?: {
        onSuccess?: (id: number) => void;
        onError?: (err: string) => void;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await categoriesController.create(data);
        if (res.success && res.data) {
          options?.onSuccess?.(res.data.id);
          return res.data.id;
        } else {
          const msg = res.error ?? "Failed to create category";
          setError(msg);
          options?.onError?.(msg);
          return null;
        }
      } catch {
        const msg = "Could not reach category service";
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

// ── useUpdateCategory ─────────────────────────────────────────────────────────

export function useUpdateCategory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (
      data: UpdateCategoryData,
      options?: {
        onSuccess?: () => void;
        onError?: (err: string) => void;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await categoriesController.update(data);
        if (res.success) {
          options?.onSuccess?.();
          return true;
        } else {
          const msg = res.error ?? "Failed to update category";
          setError(msg);
          options?.onError?.(msg);
          return false;
        }
      } catch {
        const msg = "Could not reach category service";
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

// ── useDeleteCategory ─────────────────────────────────────────────────────────

export function useDeleteCategory() {
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
        const res = await categoriesController.delete(id);
        if (res.success) {
          options?.onSuccess?.();
          return true;
        } else {
          const msg = res.error ?? "Failed to delete category";
          setError(msg);
          options?.onError?.(msg);
          return false;
        }
      } catch {
        const msg = "Could not reach category service";
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

// ── useCategoriesCRUD — all operations in one hook ────────────────────────────
// Combines list state with mutation helpers.
// Successful mutations auto-sync the local `categories` list.

export function useCategoriesCRUD() {
  const {
    categories,
    loading: listLoading,
    error: listError,
    fetch,
    setCategories,
  } = useCategories();
  const {
    create,
    loading: createLoading,
    error: createError,
  } = useCreateCategory();
  const {
    update,
    loading: updateLoading,
    error: updateError,
  } = useUpdateCategory();
  const {
    remove,
    loading: deleteLoading,
    error: deleteError,
  } = useDeleteCategory();

  // Create + re-fetch so parent_title and other joined fields are populated
  const createAndSync = useCallback(
    async (
      data: CreateCategoryData,
      options?: {
        onSuccess?: (id: number) => void;
        onError?: (err: string) => void;
      },
    ) => {
      return create(data, {
        onSuccess: async (newId) => {
          await fetch();
          options?.onSuccess?.(newId);
        },
        onError: options?.onError,
      });
    },
    [create, fetch],
  );

  // Update + patch the local list optimistically
  const updateAndSync = useCallback(
    async (
      data: UpdateCategoryData,
      options?: { onSuccess?: () => void; onError?: (err: string) => void },
    ) => {
      return update(data, {
        onSuccess: () => {
          setCategories((prev) =>
            prev.map((c) =>
              c.id === data.id
                ? {
                    ...c,
                    ...(data.title !== undefined && { title: data.title }),
                    ...(data.parent_id !== undefined && {
                      parent_id: data.parent_id,
                    }),
                  }
                : c,
            ),
          );
          options?.onSuccess?.();
        },
        onError: options?.onError,
      });
    },
    [update, setCategories],
  );

  // Delete + remove from local list immediately
  const removeAndSync = useCallback(
    async (
      id: number,
      options?: { onSuccess?: () => void; onError?: (err: string) => void },
    ) => {
      return remove(id, {
        onSuccess: () => {
          setCategories((prev) => prev.filter((c) => c.id !== id));
          options?.onSuccess?.();
        },
        onError: options?.onError,
      });
    },
    [remove, setCategories],
  );

  return {
    // List
    categories,
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
