import Database from "@tauri-apps/plugin-sql";
import type { DbClient } from "./types";

const DB_URL = "sqlite:dinero.db";

let dbPromise: Promise<DbClient> | null = null;

export function getDb(): Promise<DbClient> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}
