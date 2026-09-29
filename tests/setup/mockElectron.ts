import { vi } from "vitest";

export const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
  app: {
    getPath: () => "/tmp/naseej-test",
    isPackaged: false,
    setAppUserModelId: vi.fn(),
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
  },
  ipcMain: {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, listener);
    },
    removeHandler: (channel: string) => {
      ipcHandlers.delete(channel);
    },
    on: vi.fn(),
  },
  shell: {
    openPath: vi.fn(async () => ""),
    openExternal: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
  net: {
    fetch: vi.fn(),
  },
}));
