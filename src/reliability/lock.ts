import { invoke } from "@tauri-apps/api/core";

export type LockInfo = {
  device: string;
  pid: number;
  started_at: string;
  heartbeat_at: string;
};

export type LockChoice = "readonly" | "anyway" | "exit";

/** The lock that was already on disk when this process started, if it was
 * still fresh — null means either there was none, or it had gone stale and
 * Rust already took it over silently (SPEC-2.md 2.1). */
export function getLockConflict(): Promise<LockInfo | null> {
  return invoke<LockInfo | null>("get_lock_conflict");
}

export function resolveLockConflict(choice: LockChoice): Promise<void> {
  return invoke("resolve_lock_conflict", { choice });
}
