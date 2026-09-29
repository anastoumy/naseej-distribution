import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "@/types/Global";
import { setCurrencyFormat } from "@/lib/utils";
import { settingsController } from "@/lib/controllers";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyCurrencyFormat = useCallback((next: AppSettings) => {
    setCurrencyFormat(next.currency_symbol);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await settingsController.getAll();
    if (res.success && res.data) {
      setSettings(res.data);
      applyCurrencyFormat(res.data);
    } else {
      setError(res.error ?? "Failed to load settings");
    }
    setLoading(false);
  }, [applyCurrencyFormat]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async (data: Partial<AppSettings>) => {
    setSaving(true);
    setError(null);
    const res = await settingsController.update(data);
    setSaving(false);
    if (res.success && res.data) {
      setSettings(res.data);
      applyCurrencyFormat(res.data);
      return { success: true as const };
    }
    const message = res.error ?? "Failed to save settings";
    setError(message);
    return { success: false as const, error: message };
  }, [applyCurrencyFormat]);

  return { settings, loading, saving, error, reload, save };
}
