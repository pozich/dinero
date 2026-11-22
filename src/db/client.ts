import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type { DbClient } from "./types";

let dbPromise: Promise<DbClient> | null = null;

export function getDb(): Promise<DbClient> {
  if (!dbPromise) {
    dbPromise = invoke<string>("get_db_url").then((dbUrl) => Database.load(dbUrl));
  }
  return dbPromise;
}
