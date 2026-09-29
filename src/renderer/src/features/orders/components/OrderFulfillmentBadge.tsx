import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { OrderFulfillmentStatus } from "@/types/Global";

const STATUS_STYLES: Record<OrderFulfillmentStatus, string> = {
  pending: "bg-accent/15 text-accent border-accent/30",
  partially_received: "bg-warning/15 text-warning border-warning/30",
  received: "bg-success/15 text-success border-success/30",
  delivered: "bg-success/20 text-success border-success/40",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

interface Props {
  status: OrderFulfillmentStatus;
  className?: string;
}

export function OrderFulfillmentBadge({ status, className }: Props) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
        STATUS_STYLES[status],
        className,
      )}
    >
      {t(`orders.fulfillment.${status}`)}
    </span>
  );
}
