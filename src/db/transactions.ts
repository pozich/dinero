import type { DbClient } from "./types";

export async function findTransactionByDedupKey(
  db: DbClient,
  dedupKey: string,
): Promise<number | null> {
  const rows = await db.select<{ id: number }[]>(
    "SELECT id FROM transactions WHERE dedup_key = $1",
    [dedupKey],
  );
  return rows[0]?.id ?? null;
}

export async function insertTransaction(
  db: DbClient,
  input: {
    accountId: number;
    statementId: number | null;
    occurredAt: string;
    amountTiyin: number;
    description: string;
    rawType: string | null;
    dedupKey: string;
    relatedTransactionId?: number | null;
    isManual?: boolean;
    note?: string | null;
  },
): Promise<number> {
  const result = await db.execute(
    `INSERT INTO transactions
       (account_id, statement_id, occurred_at, amount_tiyin, description, raw_type, dedup_key, related_transaction_id, is_manual, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.accountId,
      input.statementId,
      input.occurredAt,
      input.amountTiyin,
      input.description,
      input.rawType,
      input.dedupKey,
      input.relatedTransactionId ?? null,
      input.isManual ? 1 : 0,
      input.note ?? null,
    ],
  );
  return result.lastInsertId!;
}

export async function setTransactionNote(
  db: DbClient,
  transactionId: number,
  note: string | null,
): Promise<void> {
  await db.execute("UPDATE transactions SET note = $1 WHERE id = $2", [note, transactionId]);
}

export async function setTransactionIgnored(
  db: DbClient,
  transactionId: number,
  ignored: boolean,
): Promise<void> {
  await db.execute("UPDATE transactions SET is_ignored = $1 WHERE id = $2", [
    ignored ? 1 : 0,
    transactionId,
  ]);
}

export type TransferLinkStatus = "pending" | "confirmed" | "rejected";
export type TransferLinkKind = "transfer" | "refund";

export async function insertTransferLink(
  db: DbClient,
  fromTransactionId: number,
  toTransactionId: number,
  options: { status: TransferLinkStatus; kind: TransferLinkKind },
): Promise<number> {
  const result = await db.execute(
    "INSERT INTO transfer_links (from_transaction_id, to_transaction_id, status, kind) VALUES ($1, $2, $3, $4)",
    [fromTransactionId, toTransactionId, options.status, options.kind],
  );
  return result.lastInsertId!;
}

/** Одна категория на всю сумму операции — заменяет любой предыдущий разрез. */
export async function setTransactionCategory(
  db: DbClient,
  transactionId: number,
  categoryId: number,
  amountTiyin: number,
): Promise<void> {
  await db.execute("DELETE FROM splits WHERE transaction_id = $1", [transactionId]);
  await db.execute(
    "INSERT INTO splits (transaction_id, category_id, amount_tiyin) VALUES ($1, $2, $3)",
    [transactionId, categoryId, amountTiyin],
  );
}

export type SplitInput = { categoryId: number; amountTiyin: number };

/** Разрез (Ctrl+S): сумма частей обязана совпадать с суммой операции. */
export async function setTransactionSplits(
  db: DbClient,
  transactionId: number,
  transactionAmountTiyin: number,
  splits: SplitInput[],
): Promise<void> {
  const sum = splits.reduce((a, s) => a + s.amountTiyin, 0);
  if (sum !== transactionAmountTiyin) {
    throw new Error(
      `Сумма разреза (${sum}) не совпадает с суммой операции (${transactionAmountTiyin})`,
    );
  }
  await db.execute("DELETE FROM splits WHERE transaction_id = $1", [transactionId]);
  for (const split of splits) {
    await db.execute(
      "INSERT INTO splits (transaction_id, category_id, amount_tiyin) VALUES ($1, $2, $3)",
      [transactionId, split.categoryId, split.amountTiyin],
    );
  }
}
