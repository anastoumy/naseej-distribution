import { ipcMain } from "electron";
import { z } from "zod";
import log from "../logger";

export type IpcResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

const handlerRegistry = new Map<
  string,
  (_event: unknown, rawInput?: unknown) => Promise<IpcResult>
>();

export function formatValidationError(error: z.ZodError): string {
  const message = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");

  return message || "Invalid input";
}

type InputSchema<T> = z.ZodType<T> | "void";

export function registerIpcHandler<T>(
  channel: string,
  schema: InputSchema<T>,
  handler: (input: T) => IpcResult | Promise<IpcResult>,
): void {
  const wrapped = async (_event: unknown, ...rawArgs: unknown[]): Promise<IpcResult> => {
    const started = Date.now();

    try {
      let input: T;
      const rawInput =
        rawArgs.length === 0
          ? undefined
          : rawArgs.length === 1
            ? rawArgs[0]
            : rawArgs;

      if (schema === "void") {
        input = undefined as T;
      } else {
        const parsed = schema.safeParse(rawInput);
        if (!parsed.success) {
          log.warn(`[IPC] ${channel} validation failed`, {
            issues: parsed.error.flatten(),
          });
          return {
            success: false,
            error: formatValidationError(parsed.error),
          };
        }
        input = parsed.data;
      }

      const result = await handler(input);
      log.debug(`[IPC] ${channel}`, {
        durationMs: Date.now() - started,
        success: result.success,
      });

      if (!result.success) {
        log.warn(`[IPC] ${channel} rejected`, { error: result.error });
      }

      return result;
    } catch (err) {
      log.error(`[IPC] ${channel} failed`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  };

  if (typeof ipcMain.removeHandler === "function") {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(channel, wrapped);
  handlerRegistry.set(channel, wrapped);
}

/** Test helper — invoke a registered IPC handler without Electron renderer. */
export function invokeIpcHandler<T = unknown>(
  channel: string,
  input?: unknown,
): Promise<IpcResult<T>> {
  const fn = handlerRegistry.get(channel);
  if (!fn) {
    throw new Error(`IPC handler not registered: ${channel}`);
  }

  return fn({}, input) as Promise<IpcResult<T>>;
}

export function clearIpcHandlersForTests(): void {
  for (const channel of handlerRegistry.keys()) {
    if (typeof ipcMain.removeHandler === "function") {
      ipcMain.removeHandler(channel);
    }
  }
  handlerRegistry.clear();
}
