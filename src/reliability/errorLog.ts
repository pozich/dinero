import { invoke } from "@tauri-apps/api/core";

/** SPEC-2.md 2.4 is explicit: no transaction descriptions, names, IINs or
 * account numbers in the log — ever. Callers must only pass structural
 * identifiers (an error's class/name, a source location, a numeric id),
 * never free text that could have come from a bank statement. */
export function logError(kind: string, location: string, detail?: string): void {
  invoke("log_error", { kind, location, detail: detail ?? null }).catch(() => {});
}

export function openLogsFolder(): Promise<void> {
  return invoke("open_logs_folder");
}

/** Catches whatever the rest of the app didn't — deliberately logs only
 * `error.name`/`reason`'s type and a source location, never `.message`,
 * since a thrown message could end up echoing user-entered text. */
export function installGlobalErrorLogging(): void {
  window.addEventListener("error", (event) => {
    const kind = event.error instanceof Error ? event.error.name : "Error";
    const location = `${event.filename ?? "?"}:${event.lineno ?? 0}:${event.colno ?? 0}`;
    logError(kind, location);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const kind = reason instanceof Error ? reason.name : typeof reason;
    logError(kind, "unhandledrejection");
  });
}
