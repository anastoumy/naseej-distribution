export type ToastVariant = "success" | "error" | "warning" | "info" | "neutral";

export interface ToastData {
  id: string;
  variant?: ToastVariant;
  title: string;
  description?: string;
  duration?: number; // ms; 0 = no auto-dismiss
}
