import { useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, XCircle, AlertTriangle, Info, Bell } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { ToastContext } from "./useToast";
import type { ToastData, ToastVariant } from "./toast.types";

// ─── Variant Styles ──────────────────────────────────────────────────────────

const variantConfig: Record<
  ToastVariant,
  {
    Icon: React.FC<{ className?: string }>;
    containerClass: string;
    iconClass: string;
  }
> = {
  success: {
    Icon: CheckCircle2,
    containerClass: "border-success/25 bg-card",
    iconClass: "text-success",
  },
  error: {
    Icon: XCircle,
    containerClass: "border-destructive/25 bg-card",
    iconClass: "text-destructive",
  },
  warning: {
    Icon: AlertTriangle,
    containerClass: "border-warning/25 bg-card",
    iconClass: "text-warning",
  },
  info: {
    Icon: Info,
    containerClass: "border-blue-500/25 bg-card",
    iconClass: "text-blue-400",
  },
  neutral: {
    Icon: Bell,
    containerClass: "border-border bg-card",
    iconClass: "text-muted-foreground",
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const variant: ToastVariant = toast.variant ?? "neutral";
  const config = variantConfig[variant];
  const { Icon } = config;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.94 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border shadow-lg shadow-black/30",
        "min-w-[300px] max-w-[380px] pointer-events-auto",
        config.containerClass,
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", config.iconClass)} aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{toast.description}</p>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer -mt-0.5 ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────

interface ToastStackProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed bottom-10 right-4 z-[1000] flex flex-col gap-2 items-end pointer-events-none"
    >
      <AnimatePresence initial={false} mode="sync">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (options: Omit<ToastData, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const duration = options.duration ?? 4000;

      setToasts((prev) => [...prev, { ...options, id }]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
