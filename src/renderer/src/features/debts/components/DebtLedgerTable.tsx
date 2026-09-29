import { useTranslation } from "react-i18next";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  Truck,
  PiggyBank,
  Wallet,
  History,
  Pencil,
  Trash2,
} from "lucide-react";
import type { DebtLedgerEntry } from "@/types/Global";
import { formatDate, formatJOD } from "@/lib/utils";

interface Props {
  ledger: DebtLedgerEntry[];
  loading?: boolean;
  onEditAdjustment?: (entry: DebtLedgerEntry) => void;
  onDeleteAdjustment?: (entry: DebtLedgerEntry) => void;
}

const ENTRY_ICONS = {
  order: ShoppingCart,
  collection: ArrowDownLeft,
  purchase: Truck,
  repayment: ArrowUpRight,
  prepayment: PiggyBank,
  prepayment_applied: Wallet,
  opening_balance: History,
} as const;

export function DebtLedgerTable({
  ledger,
  loading = false,
  onEditAdjustment,
  onDeleteAdjustment,
}: Props) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("common.loading")}
      </div>
    );
  }

  if (ledger.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("debts.noLedgerEntries")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="text-start px-4 py-3 font-medium text-muted-foreground">
              {t("common.date")}
            </th>
            <th className="text-start px-4 py-3 font-medium text-muted-foreground">
              {t("debts.entryType")}
            </th>
            <th className="text-start px-4 py-3 font-medium text-muted-foreground">
              {t("debts.description")}
            </th>
            <th className="text-end px-4 py-3 font-medium text-muted-foreground">
              {t("debts.amount")}
            </th>
            {(onEditAdjustment || onDeleteAdjustment) && (
              <th className="px-4 py-3" />
            )}
          </tr>
        </thead>
        <tbody>
          {ledger.map((entry) => {
            const Icon = ENTRY_ICONS[entry.entry_type];
            const isCredit = entry.amount > 0;
            const isAdjustment = entry.entry_type === "opening_balance";

            return (
              <tr
                key={`${entry.entry_type}-${entry.reference_id}-${entry.created_at}`}
                className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {formatDate(entry.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <Icon size={14} className="text-muted-foreground" />
                    {t(`debts.entryTypes.${entry.entry_type}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.description}
                </td>
                <td
                  className={`px-4 py-3 text-end font-medium tabular-nums ${
                    isCredit ? "text-destructive" : "text-success"
                  }`}
                >
                  {isCredit ? "+" : "-"}
                  {formatJOD(Math.abs(entry.amount))}
                </td>
                {(onEditAdjustment || onDeleteAdjustment) && (
                  <td className="px-4 py-3">
                    {isAdjustment && (
                      <div className="flex items-center gap-1 justify-end">
                        {onEditAdjustment && (
                          <button
                            type="button"
                            onClick={() => onEditAdjustment(entry)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            title={t("common.edit")}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {onDeleteAdjustment && (
                          <button
                            type="button"
                            onClick={() => onDeleteAdjustment(entry)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title={t("common.delete")}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
