import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DbClient, QueryResult } from "../src/db/types";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src-tauri/migrations",
);

function allMigrationsSql(): string {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf-8"))
    .join("\n");
}

// tauri-plugin-sql (sqlx) uses $1, $2, ... placeholders on SQLite;
// node:sqlite only understands positional `?`. Both are the same SQLite
// engine otherwise, so translating placeholders lets tests run the exact
// SQL the app ships.
function toPositionalSql(query: string): string {
  return query.replace(/\$\d+/g, "?");
}

/** An in-memory SQLite database, migrated with the app's real migrations,
 * exposed through the same {select, execute} shape as the Tauri sql plugin. */
export function createTestDb(): DbClient {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(allMigrationsSql());

  return {
    async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
      const stmt = sqlite.prepare(toPositionalSql(query));
      return stmt.all(...(bindValues as SQLInputValue[])) as T;
    },
    async execute(query: string, bindValues: unknown[] = []): Promise<QueryResult> {
      const stmt = sqlite.prepare(toPositionalSql(query));
      const info = stmt.run(...(bindValues as SQLInputValue[]));
      return { rowsAffected: Number(info.changes), lastInsertId: Number(info.lastInsertRowid) };
    },
  };
}
