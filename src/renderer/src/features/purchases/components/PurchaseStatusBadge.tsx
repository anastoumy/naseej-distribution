import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PurchaseStatus } from "@/types/Global";

const STATUS_STYLES: Record<PurchaseStatus, string> = {
  pending: "bg-accent/15 text-accent border-accent/30",
  partially_received: "bg-warning/15 text-warning border-warning/30",
  received: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

interface Props {
  status: PurchaseStatus;
  submitted?: boolean;
  className?: string;
}

export function PurchaseStatusBadge({ status, submitted, className }: Props) {
  const { t } = useTranslation();

  return (
    <div className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
      <span
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
          STATUS_STYLES[status],
        )}
      >
        {t(`purchases.status.${status}`)}
      </span>
      {submitted && status !== "cancelled" && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-muted text-muted-foreground border-border">
          {t("purchases.submitted")}
        </span>
      )}
    </div>
  );
}
