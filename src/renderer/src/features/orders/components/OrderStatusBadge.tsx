import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/Global";

const STATUS_STYLES: Record<OrderStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  confirmed: "bg-accent/15 text-accent border-accent/30",
  partially_paid: "bg-warning/15 text-warning border-warning/30",
  paid: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

interface Props {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: Props) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
        STATUS_STYLES[status],
        className,
      )}
    >
      {t(`orders.status.${status}`)}
    </span>
  );
}
