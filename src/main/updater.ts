import { autoUpdater } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";
import type { UpdateInfo, ProgressInfo } from "electron-updater";
import log from "./logger";

/**
 * AutoUpdater — manages application updates using electron-updater.
 * Checks for updates on startup and notifies the renderer of available updates.
 */
export class AppUpdater {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    const channel = process.env.UPDATE_CHANNEL?.trim();
    if (channel) {
      autoUpdater.channel = channel;
      log.info(`[Updater] Using release channel: ${channel}`);
    }

    this.setupListeners();
    this.setupIpcHandlers();
  }

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
  }

  checkForUpdates(): void {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error("[Updater] Check failed:", err);
    });
  }

  private setupListeners(): void {
    autoUpdater.on("checking-for-update", () => {
      this.sendToRenderer("updater:checking");
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.sendToRenderer("updater:available", {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on("update-not-available", () => {
      this.sendToRenderer("updater:not-available");
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      this.sendToRenderer("updater:progress", {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      this.sendToRenderer("updater:downloaded", {
        version: info.version,
      });
    });

    autoUpdater.on("error", (err) => {
      log.error("[Updater Error]", err);
      this.sendToRenderer("updater:error", { message: err.message });
    });
  }

  private setupIpcHandlers(): void {
    ipcMain.handle("updater:check", () => {
      this.checkForUpdates();
    });

    ipcMain.handle("updater:download", () => {
      autoUpdater.downloadUpdate().catch((err) => {
        log.error("[Updater] Download failed:", err);
      });
    });

    ipcMain.handle("updater:install", () => {
      autoUpdater.quitAndInstall(false, true);
    });
  }

  private sendToRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
