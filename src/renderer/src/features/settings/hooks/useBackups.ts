import { useCallback, useEffect, useState } from "react";
import type { BackupEntry } from "@/types/Global";
import { backupController } from "@/lib/controllers";

export function useBackups() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringPath, setRestoringPath] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await backupController.list();
    setBackups(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async () => {
    setCreating(true);
    const res = await backupController.create();
    setCreating(false);
    if (res.success) {
      await reload();
      return { success: true as const, path: res.data?.path };
    }
    return { success: false as const, error: res.error ?? "Backup failed" };
  }, [reload]);

  const restore = useCallback(async (backupPath: string) => {
    setRestoringPath(backupPath);
    const res = await backupController.restore(backupPath);
    setRestoringPath(null);
    return res;
  }, []);

  return {
    backups,
    loading,
    creating,
    restoringPath,
    reload,
    create,
    restore,
  };
}
