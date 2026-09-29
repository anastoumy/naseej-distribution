import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Database, RotateCcw, Save } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import { useSettings } from "../hooks/useSettings";
import { useBackups } from "../hooks/useBackups";
import { formatDate } from "@/lib/utils";
import { percentToTaxRate, taxRateToPercent } from "@/lib/tax";
import type { AppSettings } from "@/types/Global";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { settings, loading, saving, save } = useSettings();
  const {
    backups,
    loading: backupsLoading,
    creating,
    restoringPath,
    create,
    restore,
  } = useBackups();

  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    const res = await save(form);
    if (res.success) {
      toast({ variant: "success", title: t("settings.saveSuccess") });
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleCreateBackup = async () => {
    const res = await create();
    if (res.success) {
      toast({ variant: "success", title: t("settings.backupCreated") });
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleRestore = async (name: string, path: string) => {
    if (!confirm(t("settings.restoreConfirm", { name }))) return;

    const res = await restore(path);
    if (res.success) {
      toast({ variant: "success", title: t("settings.restoreSuccess") });
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <section className="rounded-xl bg-card border border-border p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("settings.companySection")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.companySectionHint")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="company_name"
            label={t("settings.companyName")}
            value={form.company_name}
            onChange={(e) => updateField("company_name", e.target.value)}
          />
          <Input
            id="company_name_ar"
            label={t("settings.companyNameAr")}
            value={form.company_name_ar}
            onChange={(e) => updateField("company_name_ar", e.target.value)}
          />
          <Input
            id="company_phone"
            label={t("settings.companyPhone")}
            value={form.company_phone}
            onChange={(e) => updateField("company_phone", e.target.value)}
          />
          <Input
            id="company_email"
            label={t("settings.companyEmail")}
            value={form.company_email}
            onChange={(e) => updateField("company_email", e.target.value)}
          />
          <Input
            id="company_cr"
            label={t("settings.companyCr")}
            value={form.company_cr}
            onChange={(e) => updateField("company_cr", e.target.value)}
          />
          <Input
            id="company_po_box"
            label={t("settings.companyPoBox")}
            value={form.company_po_box}
            onChange={(e) => updateField("company_po_box", e.target.value)}
          />
          <Input
            id="company_vatin"
            label={t("settings.companyVatin")}
            value={form.company_vatin}
            onChange={(e) => updateField("company_vatin", e.target.value)}
          />
          <Input
            id="invoice_prefix"
            label={t("settings.invoicePrefix")}
            value={form.invoice_prefix}
            onChange={(e) => updateField("invoice_prefix", e.target.value)}
            hint={t("settings.invoicePrefixHint")}
          />
          <div className="md:col-span-2">
            <Input
              id="company_address"
              label={t("settings.companyAddress")}
              value={form.company_address}
              onChange={(e) => updateField("company_address", e.target.value)}
            />
          </div>
          <Input
            id="currency_symbol"
            label={t("settings.currencySymbol")}
            value={form.currency_symbol}
            onChange={(e) => updateField("currency_symbol", e.target.value)}
            hint={t("settings.currencySymbolHint")}
          />
          <Input
            id="default_tax"
            type="number"
            min={0}
            max={100}
            step="0.01"
            label={t("settings.defaultTax")}
            value={taxRateToPercent(form.default_tax)}
            onChange={(e) =>
              updateField(
                "default_tax",
                percentToTaxRate(Number(e.target.value) || 0),
              )
            }
            hint={t("settings.defaultTaxHint")}
          />
          <div className="md:col-span-2 flex flex-col gap-1">
            <label htmlFor="invoice_footer" className="text-sm font-medium text-foreground">
              {t("settings.invoiceFooter")}
            </label>
            <textarea
              id="invoice_footer"
              value={form.invoice_footer}
              onChange={(e) => updateField("invoice_footer", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("settings.backupSection")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settings.backupSectionHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateBackup()}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
          >
            <Database size={16} />
            {creating ? t("settings.creatingBackup") : t("settings.createBackup")}
          </button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          {backupsLoading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              {t("common.loading")}
            </div>
          ) : backups.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              {t("settings.noBackups")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t("settings.backupName")}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t("common.date")}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t("settings.backupSize")}
                  </th>
                  <th className="text-end px-4 py-3 font-medium text-muted-foreground">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr
                    key={backup.path}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-4 py-2.5 text-foreground font-mono text-xs">
                      {backup.name}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatDate(`${backup.date}T12:00:00`)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatFileSize(backup.size_bytes)}
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      <button
                        type="button"
                        onClick={() => void handleRestore(backup.name, backup.path)}
                        disabled={restoringPath === backup.path}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={14} />
                        {restoringPath === backup.path
                          ? t("settings.restoring")
                          : t("settings.restore")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
