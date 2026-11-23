import { invoke } from "@tauri-apps/api/core";
import { getDb } from "./db/client";
import { importStatement, type ImportResult } from "./import/importStatement";

type DineroE2eHooks = {
  importFile: (path: string) => Promise<ImportResult>;
};

declare global {
  interface Window {
    __dinero_e2e?: DineroE2eHooks;
  }
}

/**
 * A small, deliberately always-present seam for the e2e smoke test
 * (SPEC-2.md 2.5) — WebDriver can't drive the native "choose a file" dialog
 * the real import button opens, so the test calls this directly instead.
 * It does exactly what that button already does, with a path the caller
 * supplies; nothing here reaches further than the app's existing access.
 */
export function installTestHooks(): void {
  window.__dinero_e2e = {
    importFile: async (path: string) => {
      const bytes = await invoke<number[]>("read_file_bytes", { path });
      const data = new Uint8Array(bytes);
      const fileName = path.split(/[/\\]/).pop() ?? path;
      const db = await getDb();
      return importStatement(db, data, fileName);
    },
  };
}
