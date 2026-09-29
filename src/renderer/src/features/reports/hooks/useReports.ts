import { useCallback, useEffect, useState } from "react";
import type { DashboardSummary } from "@/types/Global";
import { reportsController } from "../controllers/reportsController";

export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await reportsController.getDashboardSummary();
    if (res.success && res.data) {
      setSummary(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summary, loading, reload };
}
