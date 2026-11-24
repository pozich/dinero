import type { DbClient } from "./types";
import { getAccountIdByKind } from "./accounts";
import { insertManualTransaction } from "./manualTransactions";
import { setTransactionCategory } from "./transactions";
import type { Debt, DebtRepayment, DebtDirection } from "../debts/computeDebtBalances";

type DebtDbRow = {
  id: number;
  person_id: number;
  direction: DebtDirection;
  transaction_id: number | null;
  amount_tiyin: number;
  occurred_at: string;
  due_date: string | null;
  note: string | null;
  status: "open" | "closed" | "forgiven";
};

type RepaymentDbRow = {
  id: number;
  debt_id: number;
  transaction_id: number | null;
  amount_tiyin: number;
  occurred_at: string;
};

function fromDebtRow(row: DebtDbRow): Debt {
  return {
    id: row.id,
    personId: row.person_id,
    direction: row.direction,
    amountTiyin: row.amount_tiyin,
    occurredAt: row.occurred_at,
    dueDate: row.due_date,
    note: row.note,
    status: row.status,
  };
}

function fromRepaymentRow(row: RepaymentDbRow): DebtRepayment {
  return { id: row.id, debtId: row.debt_id, amountTiyin: row.amount_tiyin, occurredAt: row.occurred_at };
}

export async function listDebts(db: DbClient): Promise<Debt[]> {
  const rows = await db.select<DebtDbRow[]>("SELECT * FROM debts");
  return rows.map(fromDebtRow);
}

export async function listRepayments(db: DbClient): Promise<DebtRepayment[]> {
  const rows = await db.select<RepaymentDbRow[]>("SELECT * FROM debt_repayments");
  return rows.map(fromRepaymentRow);
}

export type UnlinkedTransaction = { id: number; occurred_at: string; amount_tiyin: number; description: string };

/** The pool findRepaymentCandidates searches over — every transaction not
 * already the subject of a debt or a repayment, so the same transaction
 * can't be suggested twice. */
export function listTransactionsNotLinkedToAnyDebt(db: DbClient): Promise<UnlinkedTransaction[]> {
  return db.select<UnlinkedTransaction[]>(
    `SELECT t.id, t.occurred_at, t.amount_tiyin, t.description FROM transactions t
     WHERE t.id NOT IN (SELECT transaction_id FROM debts WHERE transaction_id IS NOT NULL)
       AND t.id NOT IN (SELECT transaction_id FROM debt_repayments WHERE transaction_id IS NOT NULL)`,
  );
}

export type CreateDebtInput = {
  personId: number;
  direction: DebtDirection;
  transactionId: number | null;
  amountTiyin: number;
  occurredAt: string;
  dueDate: string | null;
  note: string | null;
};

/** `transactionId` is set when marked from an existing bank transfer
 * (context menu), null for a manual/cash record that doesn't touch any
 * account balance (SPEC-2.md 8's "ручная запись"). */
export async function createDebt(db: DbClient, input: CreateDebtInput): Promise<number> {
  const result = await db.execute(
    `INSERT INTO debts (person_id, direction, transaction_id, amount_tiyin, occurred_at, due_date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.personId, input.direction, input.transactionId, input.amountTiyin, input.occurredAt, input.dueDate, input.note],
  );
  return result.lastInsertId!;
}

export async function deleteDebt(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM debts WHERE id = $1", [id]);
}

/** `transactionId` null for "ручной возврат наличными" (SPEC-2.md 8). */
export async function recordRepayment(
  db: DbClient,
  debtId: number,
  transactionId: number | null,
  amountTiyin: number,
  occurredAt: string,
): Promise<number> {
  const result = await db.execute(
    "INSERT INTO debt_repayments (debt_id, transaction_id, amount_tiyin, occurred_at) VALUES ($1, $2, $3, $4)",
    [debtId, transactionId, amountTiyin, occurredAt],
  );
  return result.lastInsertId!;
}

export async function deleteRepayment(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM debt_repayments WHERE id = $1", [id]);
}

/**
 * SPEC-2.md 8: "простил долг → остаток превращается в расход с выбранной
 * категорией". Deliberately NOT recorded as a debt_repayment — this new
 * transaction is meant to actually count as a real expense (that's the
 * whole point of forgiving it), so it must stay outside the
 * debts/debt_repayments set `ledgerQuery.ts` excludes from the ledger.
 * Lands on the virtual "Наличные" account, since a forgiven debt has no
 * real bank account of its own to charge it to. Restricted to "lent"
 * debts only — the spec's own wording ("расход") only makes sense for
 * money you lent and are writing off, not money you borrowed.
 */
export async function forgiveDebt(
  db: DbClient,
  debtId: number,
  remainingTiyin: number,
  categoryId: number,
  description: string,
): Promise<number> {
  const cashAccountId = await getAccountIdByKind(db, "cash");
  const transactionId = await insertManualTransaction(db, {
    accountId: cashAccountId,
    occurredAt: new Date().toISOString(),
    amountTiyin: -remainingTiyin,
    description,
  });
  await setTransactionCategory(db, transactionId, categoryId, -remainingTiyin);
  await db.execute("UPDATE debts SET status = 'forgiven' WHERE id = $1", [debtId]);
  return transactionId;
}
