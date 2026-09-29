import { createContext, useContext } from "react";
import type { ToastData, ToastVariant } from "./toast.types";

export interface ToastContextValue {
  toasts: ToastData[];
  toast: (options: Omit<ToastData, "id"> & { variant?: ToastVariant }) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
