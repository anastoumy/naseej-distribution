import { BrowserWindow } from "electron";
import { pathToFileURL } from "url";

export function printPdfFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
      },
    });

    win
      .loadURL(pathToFileURL(filePath).href)
      .then(() => {
        win.webContents.print(
          { silent: false, printBackground: true },
          (success, failureReason) => {
            win.destroy();
            if (!success) {
              reject(new Error(failureReason || "Print failed"));
              return;
            }
            resolve();
          },
        );
      })
      .catch((error) => {
        win.destroy();
        reject(error);
      });
  });
}
