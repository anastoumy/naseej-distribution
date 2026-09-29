import { app, shell, BrowserWindow, ipcMain, protocol, net } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import log from "./logger";
import { closeDb, getDb } from "./db/database";
import { createBackup, listBackups, restoreBackup } from "./db/backup";
import { AppUpdater } from "./updater";
import { registerCategoryHandlers } from "./ipc/categories";
import { registerFlavorHandlers } from "./ipc/flavors";
import { registerSupplierHandlers } from "./ipc/suppliers";
import { registerCustomerHandlers } from "./ipc/customers";
import { registerProductHandlers } from "./ipc/products";
import { registerOrderHandlers } from "./ipc/order";
import { registerPurchaseHandlers } from "./ipc/purchases";
import { registerInventoryHandlers } from "./ipc/inventory";
import { registerDebtHandlers } from "./ipc/debts";
import { registerReportHandlers } from "./ipc/reports";
import { registerSettingsHandlers } from "./ipc/settings";

// ── Must be called before app is ready ───────────────────────────────────────
protocol.registerSchemesAsPrivileged([
  {
    scheme: "asset",
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  },
]);

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught exception", error);
});

// ─────────────────────────────────────────────────────────────────────────────

let appUpdater: AppUpdater | null = null;

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#020617",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  if (!is.dev) {
    if (!appUpdater) appUpdater = new AppUpdater();
    appUpdater.initialize(mainWindow);
    setTimeout(() => appUpdater?.checkForUpdates(), 5000);
  }

  return mainWindow;
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.naseej.lite");

  // ── Asset protocol — serves local product images safely ─────────────────
  // Must be registered after app is ready, handles asset://path → file://path
  protocol.handle("asset", (request) => {
    const filePath = decodeURIComponent(request.url.slice("asset://".length));
    return net.fetch(`file://${encodeURI(filePath)}`);
  });

  // ── Database ─────────────────────────────────────────────────────────────
  const db = getDb();

  // Daily auto-backup on launch
  const backups = listBackups();
  const today = new Date().toISOString().split("T")[0];
  if (!backups.some((b) => b.date === today)) {
    createBackup(db);
  }

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // ── Window controls ──────────────────────────────────────────────────────
  ipcMain.on("window:minimize", (e) =>
    BrowserWindow.fromWebContents(e.sender)?.minimize(),
  );
  ipcMain.on("window:maximize", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on("window:close", (e) =>
    BrowserWindow.fromWebContents(e.sender)?.close(),
  );

  // ── Backup ───────────────────────────────────────────────────────────────
  ipcMain.handle("backup:create", () => createBackup(getDb()));
  ipcMain.handle("backup:list", () => listBackups());
  ipcMain.handle("backup:restore", (e, backupPath: string) => {
    const result = restoreBackup(backupPath);
    if (result.success) {
      const win = BrowserWindow.fromWebContents(e.sender);
      win?.webContents.reload();
    }
    return result;
  });

  // ── Domain handlers ──────────────────────────────────────────────────────
  registerCategoryHandlers();
  registerFlavorHandlers();
  registerSupplierHandlers();
  registerCustomerHandlers();
  registerProductHandlers();
  registerOrderHandlers();
  registerPurchaseHandlers();
  registerInventoryHandlers();
  registerDebtHandlers();
  registerReportHandlers();
  registerSettingsHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  closeDb();
  if (process.platform !== "darwin") app.quit();
});
