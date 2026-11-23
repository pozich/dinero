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

export type StatementSummary = StatementRow & {
  account_name: string;
  transaction_count: number;
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

export function listStatements(db: DbClient): Promise<StatementSummary[]> {
  // Mirrored Kaspi Deposit/«Наличные» rows share the statement_id but live on
  // a different account — the card's count should match what was actually
  // in the uploaded file, so it's scoped to the statement's own account.
  return db.select<StatementSummary[]>(
    `SELECT s.*, a.name AS account_name,
            (SELECT COUNT(*) FROM transactions t
               WHERE t.statement_id = s.id AND t.account_id = s.account_id) AS transaction_count
     FROM statements s
     JOIN accounts a ON a.id = s.account_id
     ORDER BY s.imported_at DESC`,
  );
}

/** How many of this statement's transactions already have a category — used
 * to warn before deleting (SPEC.md 6.5). */
export async function countCategorizedTransactions(
  db: DbClient,
  statementId: number,
): Promise<number> {
  const rows = await db.select<{ n: number }[]>(
    `SELECT COUNT(DISTINCT t.id) AS n
     FROM transactions t
     JOIN splits sp ON sp.transaction_id = t.id
     WHERE t.statement_id = $1`,
    [statementId],
  );
  return rows[0]?.n ?? 0;
}

/** Deletes a statement and everything that points at its transactions
 * (splits, transfer_links, the transactions themselves — fees/mirrors
 * included, since they share the same statement_id). */
export async function deleteStatement(db: DbClient, statementId: number): Promise<void> {
  const ids = await db.select<{ id: number }[]>(
    "SELECT id FROM transactions WHERE statement_id = $1",
    [statementId],
  );
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const params = ids.map((r) => r.id);
    await db.execute(`DELETE FROM splits WHERE transaction_id IN (${placeholders})`, params);
    await db.execute(
      `DELETE FROM transfer_links WHERE from_transaction_id IN (${placeholders}) OR to_transaction_id IN (${placeholders})`,
      [...params, ...params],
    );
  }
  await db.execute("DELETE FROM transactions WHERE statement_id = $1", [statementId]);
  await db.execute("DELETE FROM statements WHERE id = $1", [statementId]);
}
