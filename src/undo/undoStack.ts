import type { DbClient } from "../db/types";

type RowSnapshot = Record<string, unknown>;

export type EntrySpec = { table: string; whereSql: string; params: unknown[] };
type Entry = EntrySpec & { before: RowSnapshot[] };
type Action = { label: string; entries: Entry[] };

const MAX_DEPTH = 50;

/**
 * Generic snapshot-based undo (SPEC-2.md 2.3, chosen over a per-action
 * command log): every step records the full "before" rows for a set of
 * `{table, whereSql, params}` specs, runs the mutation, and undo/redo just
 * replays "delete what's there, re-insert what was captured" — the same
 * code path whether the original action was an insert, update, or a
 * delete-and-reinsert (like replacing a transaction's splits). Lives only
 * in memory for this session, per spec — nothing here is persisted.
 */
export class UndoStack {
  private undoList: Action[] = [];
  private redoList: Action[] = [];
  private listeners = new Set<() => void>();

  constructor(private db: DbClient) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  canUndo(): boolean {
    return this.undoList.length > 0;
  }

  canRedo(): boolean {
    return this.redoList.length > 0;
  }

  private captureRows(spec: EntrySpec): Promise<RowSnapshot[]> {
    return this.db.select<RowSnapshot[]>(
      `SELECT * FROM ${spec.table} WHERE ${spec.whereSql}`,
      spec.params,
    );
  }

  /** Captures "before" for each spec, runs `mutate`, then pushes one undo
   * step covering all of them as a single action. */
  async run(label: string, specs: EntrySpec[], mutate: () => Promise<void>): Promise<void> {
    const entries: Entry[] = [];
    for (const spec of specs) {
      entries.push({ ...spec, before: await this.captureRows(spec) });
    }
    await mutate();
    this.push(label, entries);
  }

  /** For a freshly-created row whose id is only known *after* insertion —
   * "before" is simply empty, so undo deletes the row that didn't exist yet. */
  pushCreated(label: string, table: string, id: number): void {
    this.push(label, [{ table, whereSql: "id = $1", params: [id], before: [] }]);
  }

  private push(label: string, entries: Entry[]): void {
    this.undoList.push({ label, entries });
    if (this.undoList.length > MAX_DEPTH) this.undoList.shift();
    this.redoList = [];
    this.notify();
  }

  private async restoreRows(spec: EntrySpec, rows: RowSnapshot[]): Promise<void> {
    await this.db.execute(`DELETE FROM ${spec.table} WHERE ${spec.whereSql}`, spec.params);
    for (const row of rows) {
      const columns = Object.keys(row);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      await this.db.execute(
        `INSERT INTO ${spec.table} (${columns.join(", ")}) VALUES (${placeholders})`,
        columns.map((c) => row[c]),
      );
    }
  }

  private async swap(from: Action[], to: Action[]): Promise<string | null> {
    const action = from.pop();
    if (!action) return null;
    const opposite: Entry[] = [];
    for (const entry of action.entries) {
      const current = await this.captureRows(entry);
      opposite.push({ ...entry, before: current });
      await this.restoreRows(entry, entry.before);
    }
    to.push({ label: action.label, entries: opposite });
    this.notify();
    return action.label;
  }

  undo(): Promise<string | null> {
    return this.swap(this.undoList, this.redoList);
  }

  redo(): Promise<string | null> {
    return this.swap(this.redoList, this.undoList);
  }
}

/** Convenience for call sites that have a stack but don't want to special
 * case the "not loaded yet" moment — falls back to running the mutation
 * un-tracked rather than blocking it. */
export async function withUndo(
  stack: UndoStack | null,
  label: string,
  specs: EntrySpec[],
  mutate: () => Promise<void>,
): Promise<void> {
  if (stack) {
    await stack.run(label, specs, mutate);
  } else {
    await mutate();
  }
}
