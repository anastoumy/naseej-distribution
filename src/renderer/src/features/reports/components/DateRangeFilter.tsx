import { useTranslation } from "react-i18next";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onReset: () => void;
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
}: DateRangeFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("reports.from")}
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("reports.to")}
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        />
      </label>
      <button
        type="button"
        onClick={onReset}
        className="h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {t("common.reset")}
      </button>
    </div>
  );
}
