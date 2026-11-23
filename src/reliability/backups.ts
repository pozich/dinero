import { invoke } from "@tauri-apps/api/core";

export type BackupMeta = {
  name: string;
  reason: string;
  created_at: string;
  size_bytes: number;
};

export type BackupReason = "startup" | "import" | "delete_statement" | "bulk_action" | "apply_rules";

/** Copies the live db into vault/backups/ before a risky action, and prunes
 * old ones (SPEC-2.md 2.2). Returns null when nothing was written — either
 * there's no db yet, or `reason === "startup"` already ran today. Failures
 * are swallowed on purpose: a backup that couldn't be made must never block
 * the action it was guarding. */
export async function backupBefore(reason: BackupReason): Promise<void> {
  try {
    await invoke<string | null>("make_backup", { reason });
  } catch {
    // see comment above
  }
}

export function listBackups(): Promise<BackupMeta[]> {
  return invoke<BackupMeta[]>("list_backups");
}

export function restoreBackup(name: string): Promise<void> {
  return invoke("restore_backup", { name });
}
