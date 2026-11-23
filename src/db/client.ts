import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type { DbClient } from "./types";

let dbPromise: Promise<DbClient> | null = null;

/** sqlx forces `journal_mode=WAL` on its own connection while running
 * migrations (see sqlx-sqlite's `migrate.rs`) and that setting is sticky in
 * the db file header afterwards. We don't want `-wal`/`-shm` files sitting
 * in the vault for Syncthing to race with (SPEC-2.md 2.1) — one PRAGMA on
 * the first real connection switches it back, no Rust-side change needed. */
async function loadDb(): Promise<DbClient> {
  const dbUrl = await invoke<string>("get_db_url");
  const db = await Database.load(dbUrl);
  await db.execute("PRAGMA journal_mode = DELETE");
  return db;
}

export function getDb(): Promise<DbClient> {
  if (!dbPromise) {
    dbPromise = loadDb();
  }
  return dbPromise;
}
