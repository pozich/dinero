export type QueryResult = {
  rowsAffected: number;
  lastInsertId?: number;
};

/** Structural subset of `@tauri-apps/plugin-sql`'s `Database` that the app's
 * db layer depends on — narrow enough that tests can satisfy it with a
 * node:sqlite-backed fake instead of the real Tauri plugin. */
export interface DbClient {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
}
