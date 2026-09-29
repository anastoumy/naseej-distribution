import { useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "../../../../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  /** Prevent closing by clicking backdrop */
  persistent?: boolean;
  className?: string;
}

// ─── Size Map ─────────────────────────────────────────────────────────────────

const sizeClass: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[calc(100vw-3rem)]",
};

// ─── Animation Variants ──────────────────────────────────────────────────────

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
  persistent = false,
  className,
}: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useFocusTrap<HTMLDivElement>(open);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !persistent) onClose();
    },
    [onClose, persistent],
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
            key="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[800] bg-black/60 backdrop-blur-sm"
            onClick={!persistent ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Scroll container */}
          <div
            className="fixed inset-0 z-[801] flex items-center justify-center p-6 overflow-y-auto"
            onClick={!persistent ? onClose : undefined}
          >
            {/* Panel */}
            <motion.div
              key="modal-panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? "modal-title" : undefined}
              aria-describedby={description ? "modal-desc" : undefined}
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                "relative w-full bg-card border border-border rounded-2xl shadow-2xl shadow-black/40",
                "flex flex-col max-h-[85vh]",
                sizeClass[size],
                className,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || description) && (
                <div className="flex items-start gap-3 p-6 pb-4 border-b border-border shrink-0">
                  <div className="flex-1 min-w-0">
                    {title && (
                      <h2
                        id="modal-title"
                        className="text-base font-semibold text-foreground"
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p
                        id="modal-desc"
                        className="mt-1 text-sm text-muted-foreground"
                      >
                        {description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={onClose}
                    aria-label={t("common.closeModal")}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer -mt-0.5"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">{children}</div>

              {/* Footer */}
              {footer && (
                <div className="shrink-0 px-6 py-4 border-t border-border">{footer}</div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
