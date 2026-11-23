import { invoke } from "@tauri-apps/api/core";

/** Names of any `*sync-conflict*` files Syncthing left in the vault root
 * (SPEC-2.md 2.1) — present only when it couldn't merge a change made on
 * two devices before they next synced. */
export function detectSyncConflicts(): Promise<string[]> {
  return invoke<string[]>("detect_sync_conflicts");
}
