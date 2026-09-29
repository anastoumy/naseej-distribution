import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Customer, OrderPaymentType, Product } from "@/types/Global";
import { OrderLineItemsEditor } from "../components/OrderLineItemsEditor";
import { useSettings } from "@/features/settings/hooks/useSettings";
import {
  calculateOrderTotal,
  toOrderItemInput,
  type LineDraft,
} from "../utils/orderCalculations";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    customer_id: number;
    payment_type?: OrderPaymentType;
    notes?: string | null;
    items?: ReturnType<typeof toOrderItemInput>[];
    total_price?: number;
  }) => Promise<{ success: boolean; error?: string; data?: { id: number } }>;
  customers: Customer[];
  products: Product[];
}

export function CreateOrderModal({
  open,
  onClose,
  onCreate,
  customers,
  products,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { settings } = useSettings();
  const defaultTaxRate = settings?.default_tax ?? 0.05;
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState<OrderPaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ customer?: string; items?: string }>(
    {},
  );

  const reset = () => {
    setCustomerId("");
    setPaymentType("cash");
    setNotes("");
    setLines([]);
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!customerId) newErrors.customer = t("common.required");
    if (lines.length === 0) newErrors.items = t("orders.itemsRequired");

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    const total = calculateOrderTotal(lines);
    const res = await onCreate({
      customer_id: Number(customerId),
      payment_type: paymentType,
      notes: notes.trim() || null,
      items: lines.map(toOrderItemInput),
      total_price: total,
    });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("orders.createSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("orders.createTitle")}
      description={t("orders.createSubtitle")}
      size="xl"
      footer={
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            form="create-order-form"
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? t("common.loading") : t("orders.saveDraft")}
          </button>
        </div>
      }
    >
      <form
        id="create-order-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="order-customer"
              className="text-sm font-medium text-foreground"
            >
              {t("orders.customer")}
              <span className="text-destructive ms-1">*</span>
            </label>
            <select
              id="order-customer"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setErrors((prev) => ({ ...prev, customer: undefined }));
              }}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="">{t("orders.selectCustomer")}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.customer && (
              <p className="text-xs text-destructive">{errors.customer}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="order-payment"
              className="text-sm font-medium text-foreground"
            >
              {t("orders.paymentType")}
            </label>
            <select
              id="order-payment"
              value={paymentType}
              onChange={(e) =>
                setPaymentType(e.target.value as OrderPaymentType)
              }
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="cash">{t("orders.payment.cash")}</option>
              <option value="credit">{t("orders.payment.credit")}</option>
            </select>
          </div>
        </div>

        <Input
          id="order-notes"
          label={t("common.notes")}
          placeholder={t("orders.notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div>
          <OrderLineItemsEditor
            lines={lines}
            onChange={(next) => {
              setLines(next);
              if (next.length > 0) {
                setErrors((prev) => ({ ...prev, items: undefined }));
              }
            }}
            products={products}
            defaultTaxRate={defaultTaxRate}
          />
          {errors.items && (
            <p className="text-xs text-destructive mt-2">{errors.items}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
