import type { DbClient } from "./types";
import { insertTransaction } from "./transactions";
import type { MatchableTransaction } from "../import/mergeManualCandidates";

/** Every manual entry, in the shape findMergeCandidates expects — the
 * column aliases do the camelCase conversion so no mapping step is needed. */
export function listManualTransactions(db: DbClient): Promise<MatchableTransaction[]> {
  return db.select<MatchableTransaction[]>(
    `SELECT t.id, a.kind AS accountKind, t.occurred_at AS occurredAt, t.amount_tiyin AS amountTiyin
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.is_manual = 1`,
  );
}

export async function listTransactionsByIdsMatchable(
  db: DbClient,
  ids: number[],
): Promise<MatchableTransaction[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  return db.select<MatchableTransaction[]>(
    `SELECT t.id, a.kind AS accountKind, t.occurred_at AS occurredAt, t.amount_tiyin AS amountTiyin
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.id IN (${placeholders})`,
    ids,
  );
}

export type ManualTransactionInput = {
  accountId: number;
  occurredAt: string;
  amountTiyin: number;
  description: string;
  note?: string | null;
};

/** Manual entries don't come from a statement, so there's nothing to
 * deduplicate against — a synthetic, always-unique key instead of the
 * usual (account, date, amount, description, №повтора) one. Two identical
 * manual entries (two coffees, same price, same day) are allowed, same
 * principle as real imported rows (SPEC.md 6.2). */
function randomManualDedupKey(): string {
  return `manual:${crypto.randomUUID()}`;
}

export function insertManualTransaction(db: DbClient, input: ManualTransactionInput): Promise<number> {
  return insertTransaction(db, {
    accountId: input.accountId,
    statementId: null,
    occurredAt: input.occurredAt,
    amountTiyin: input.amountTiyin,
    description: input.description,
    rawType: null,
    dedupKey: randomManualDedupKey(),
    isManual: true,
    note: input.note ?? null,
  });
}

async function requireManual(db: DbClient, transactionId: number): Promise<void> {
  const [row] = await db.select<{ is_manual: number }[]>(
    "SELECT is_manual FROM transactions WHERE id = $1",
    [transactionId],
  );
  if (!row || !row.is_manual) {
    throw new Error("Сумму, дату, счёт и описание можно менять только у ручных операций");
  }
}

export type ManualTransactionPatch = {
  accountId?: number;
  occurredAt?: string;
  amountTiyin?: number;
  description?: string;
  note?: string | null;
};

/** SPEC-2.md 4.1: imported rows can only have their category/note/flags
 * changed — amount/date/description are read-only. Enforced here too, not
 * just in the UI, as a safety net against future call sites. */
export async function updateManualTransaction(
  db: DbClient,
  transactionId: number,
  patch: ManualTransactionPatch,
): Promise<void> {
  await requireManual(db, transactionId);

  const fields: string[] = [];
  const params: unknown[] = [];
  if (patch.accountId !== undefined) {
    params.push(patch.accountId);
    fields.push(`account_id = $${params.length}`);
  }
  if (patch.occurredAt !== undefined) {
    params.push(patch.occurredAt);
    fields.push(`occurred_at = $${params.length}`);
  }
  if (patch.amountTiyin !== undefined) {
    params.push(patch.amountTiyin);
    fields.push(`amount_tiyin = $${params.length}`);
  }
  if (patch.description !== undefined) {
    params.push(patch.description);
    fields.push(`description = $${params.length}`);
  }
  if (patch.note !== undefined) {
    params.push(patch.note);
    fields.push(`note = $${params.length}`);
  }
  if (fields.length === 0) return;

  params.push(transactionId);
  await db.execute(`UPDATE transactions SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
}

export async function deleteManualTransaction(db: DbClient, transactionId: number): Promise<void> {
  await requireManual(db, transactionId);
  await db.execute(
    "DELETE FROM transfer_links WHERE from_transaction_id = $1 OR to_transaction_id = $1",
    [transactionId],
  );
  await db.execute("DELETE FROM splits WHERE transaction_id = $1", [transactionId]);
  await db.execute("DELETE FROM transactions WHERE id = $1", [transactionId]);
}

/**
 * Confirmed "это та же операция?" (SPEC-2.md 4.1): the manual entry's
 * note/category carry over onto the real imported row, and the manual
 * entry itself goes away — the imported row is the one with provenance.
 */
export async function mergeManualIntoImported(
  db: DbClient,
  manualId: number,
  importedId: number,
): Promise<void> {
  const [manual] = await db.select<{ note: string | null }[]>(
    "SELECT note FROM transactions WHERE id = $1",
    [manualId],
  );
  const manualSplits = await db.select<{ category_id: number; amount_tiyin: number }[]>(
    "SELECT category_id, amount_tiyin FROM splits WHERE transaction_id = $1",
    [manualId],
  );

  if (manual?.note) {
    await db.execute("UPDATE transactions SET note = $1 WHERE id = $2", [manual.note, importedId]);
  }
  if (manualSplits.length > 0) {
    await db.execute("DELETE FROM splits WHERE transaction_id = $1", [importedId]);
    for (const split of manualSplits) {
      await db.execute(
        "INSERT INTO splits (transaction_id, category_id, amount_tiyin) VALUES ($1, $2, $3)",
        [importedId, split.category_id, split.amount_tiyin],
      );
    }
  }

  await db.execute(
    "DELETE FROM transfer_links WHERE from_transaction_id = $1 OR to_transaction_id = $1",
    [manualId],
  );
  await db.execute("DELETE FROM splits WHERE transaction_id = $1", [manualId]);
  await db.execute("DELETE FROM transactions WHERE id = $1", [manualId]);
}
