import { useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Trash2, Archive, LogOut, HelpCircle } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DialogVariant = "danger" | "warning" | "info" | "neutral";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  variant?: DialogVariant;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  icon?: ReactNode;
}

// ─── Variant Config ───────────────────────────────────────────────────────────

const variantConfig: Record<
  DialogVariant,
  {
    Icon: React.FC<{ className?: string }>;
    iconWrapper: string;
    iconClass: string;
    confirmClass: string;
  }
> = {
  danger: {
    Icon: Trash2,
    iconWrapper: "bg-destructive/15",
    iconClass: "text-destructive",
    confirmClass:
      "bg-destructive text-white hover:bg-destructive/90 focus:ring-destructive/50",
  },
  warning: {
    Icon: AlertTriangle,
    iconWrapper: "bg-warning/15",
    iconClass: "text-warning",
    confirmClass:
      "bg-warning text-warning-foreground hover:bg-warning/90 focus:ring-warning/50",
  },
  info: {
    Icon: HelpCircle,
    iconWrapper: "bg-blue-500/15",
    iconClass: "text-blue-400",
    confirmClass:
      "bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-500/50",
  },
  neutral: {
    Icon: Archive,
    iconWrapper: "bg-muted",
    iconClass: "text-muted-foreground",
    confirmClass:
      "bg-accent text-accent-foreground hover:bg-accent/90 focus:ring-ring",
  },
};

// ─── Backdrop ─────────────────────────────────────────────────────────────────

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.93, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.93, y: 8 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  onConfirm,
  variant = "neutral",
  title,
  description,
  confirmLabel,
  cancelLabel,
  loading = false,
  icon,
}: DialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel || t('components.dialog.confirm');
  const resolvedCancelLabel = cancelLabel || t('components.dialog.cancel');
  const config = variantConfig[variant];
  const { Icon } = config;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="dialog-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Centering container — separate from animation so transforms don't conflict */}
          <div
            className="fixed inset-0 z-[901] flex items-center justify-center p-6 pointer-events-none"
          >
          <motion.div
            key="dialog-panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby={description ? "dialog-desc" : undefined}
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "pointer-events-auto w-full max-w-md",
              "bg-card border border-border rounded-2xl shadow-2xl shadow-black/40",
              "p-6 flex flex-col gap-5",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                config.iconWrapper,
              )}
            >
              {icon ?? <Icon className={cn("w-6 h-6", config.iconClass)} aria-hidden="true" />}
            </div>

            {/* Text */}
            <div>
              <h2
                id="dialog-title"
                className="text-base font-semibold text-foreground"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="dialog-desc"
                  className="mt-1.5 text-sm text-muted-foreground leading-relaxed"
                >
                  {description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={onClose}
                disabled={loading}
                className="btn-secondary text-sm px-4 py-2"
              >
                {resolvedCancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  "relative text-sm font-semibold rounded-lg px-4 py-2",
                  "active:scale-[0.98] transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card",
                  "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                  config.confirmClass,
                )}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Processing…
                  </span>
                ) : (
                  resolvedConfirmLabel
                )}
              </button>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
