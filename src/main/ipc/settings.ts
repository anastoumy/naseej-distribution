import { getDb } from "../db/database";
import { getAppSettings, setAppSettings } from "../services/settings";
import { registerIpcHandler } from "./handler";
import { settingsUpdateSchema } from "./validation";

export function registerSettingsHandlers(): void {
  registerIpcHandler("settings:getAll", "void", () => {
    const data = getAppSettings(getDb());
    return { success: true, data };
  });

  registerIpcHandler("settings:update", settingsUpdateSchema, (data) => {
    const db = getDb();
    setAppSettings(db, data);
    return { success: true, data: getAppSettings(db) };
  });
}
