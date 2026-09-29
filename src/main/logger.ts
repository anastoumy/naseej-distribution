import log from "electron-log";

log.transports.file.level = process.env.VITEST ? false : "info";
log.transports.console.level = process.env.VITEST ? "error" : "debug";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require("electron") as typeof import("electron");
  if (app?.isPackaged) {
    const { join } = require("path") as typeof import("path");
    log.transports.file.resolvePathFn = () =>
      join(app.getPath("userData"), "logs", "main.log");
  }
} catch {
  // Electron unavailable outside the desktop runtime.
}

log.info("Logger initialized");

export default log;
