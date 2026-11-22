import type { DbClient } from "./types";

export type StatementRow = {
  id: number;
  account_id: number;
  bank: string;
  period_start: string;
  period_end: string;
  file_hash: string;
  file_name: string;
  imported_at: string;
};

export async function findStatementByHash(
  db: DbClient,
  fileHash: string,
): Promise<StatementRow | null> {
  const rows = await db.select<StatementRow[]>(
    "SELECT * FROM statements WHERE file_hash = $1",
    [fileHash],
  );
  return rows[0] ?? null;
}

export async function insertStatement(
  db: DbClient,
  input: {
    accountId: number;
    bank: string;
    periodStart: string;
    periodEnd: string;
    fileHash: string;
    fileName: string;
  },
): Promise<number> {
  const result = await db.execute(
    `INSERT INTO statements (account_id, bank, period_start, period_end, file_hash, file_name)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.accountId,
      input.bank,
      input.periodStart,
      input.periodEnd,
      input.fileHash,
      input.fileName,
    ],
  );
  return result.lastInsertId!;
}

export function listStatements(db: DbClient): Promise<StatementRow[]> {
  return db.select<StatementRow[]>("SELECT * FROM statements ORDER BY imported_at DESC");
}
