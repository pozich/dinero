import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { createPerson } from "../../src/db/people";
import {
  createDebt,
  deleteDebt,
  listDebts,
  listRepayments,
  recordRepayment,
  deleteRepayment,
  forgiveDebt,
  listTransactionsNotLinkedToAnyDebt,
} from "../../src/db/debts";
import { queryTransactions } from "../../src/db/transactionsQuery";
import { findOrCreateCategory } from "../../src/db/categories";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";

async function seedDebt(db: Awaited<ReturnType<typeof createTestDb>> | ReturnType<typeof createTestDb>) {
  const personId = await createPerson(db, "Роман");
  const debtId = await createDebt(db, {
    personId,
    direction: "lent",
    transactionId: null,
    amountTiyin: 500000,
    occurredAt: "2026-01-01T00:00:00.000Z",
    dueDate: null,
    note: null,
  });
  return { personId, debtId };
}

describe("debts", () => {
  it("creates and lists a debt", async () => {
    const db = createTestDb();
    const { debtId, personId } = await seedDebt(db);
    const [debt] = await listDebts(db);
    expect(debt).toMatchObject({ id: debtId, personId, direction: "lent", amountTiyin: 500000, status: "open" });
  });

  it("deletes a debt", async () => {
    const db = createTestDb();
    const { debtId } = await seedDebt(db);
    await deleteDebt(db, debtId);
    expect(await listDebts(db)).toHaveLength(0);
  });

  it("records a manual (cash) repayment with no transaction behind it", async () => {
    const db = createTestDb();
    const { debtId } = await seedDebt(db);
    await recordRepayment(db, debtId, null, 200000, "2026-01-10T00:00:00.000Z");
    const [repayment] = await listRepayments(db);
    expect(repayment).toMatchObject({ debtId, amountTiyin: 200000 });
  });

  it("deletes a repayment", async () => {
    const db = createTestDb();
    const { debtId } = await seedDebt(db);
    const repaymentId = await recordRepayment(db, debtId, null, 200000, "2026-01-10T00:00:00.000Z");
    await deleteRepayment(db, repaymentId);
    expect(await listRepayments(db)).toHaveLength(0);
  });

  it("forgiving a debt creates a real categorized expense on the cash account, not a tracked repayment", async () => {
    const db = createTestDb();
    const { debtId } = await seedDebt(db);
    const giftsCategory = await findOrCreateCategory(db, "Подарки");

    const transactionId = await forgiveDebt(db, debtId, 500000, giftsCategory, "Простил долг: Роман");

    const [debt] = await listDebts(db);
    expect(debt.status).toBe("forgiven");
    expect(await listRepayments(db)).toHaveLength(0);

    const [transaction] = await queryTransactions(db, { ids: [transactionId] });
    expect(transaction).toMatchObject({ amount_tiyin: -500000, category_id: giftsCategory, account_kind: "cash" });
  });
});

describe("listTransactionsNotLinkedToAnyDebt", () => {
  async function insertTx(db: ReturnType<typeof createTestDb>, dedupKey: string, amountTiyin: number) {
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    return insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-10T00:00:00.000Z",
      amountTiyin,
      description: "Роман П.",
      rawType: null,
      dedupKey,
    });
  }

  it("excludes a transaction already behind a debt or a repayment", async () => {
    const db = createTestDb();
    const debtTxId = await insertTx(db, "d1", -500000);
    const repaymentTxId = await insertTx(db, "r1", 200000);
    const freeTxId = await insertTx(db, "f1", 300000);

    const personId = await createPerson(db, "Роман");
    const debtId = await createDebt(db, {
      personId,
      direction: "lent",
      transactionId: debtTxId,
      amountTiyin: 500000,
      occurredAt: "2026-01-01T00:00:00.000Z",
      dueDate: null,
      note: null,
    });
    await recordRepayment(db, debtId, repaymentTxId, 200000, "2026-01-10T00:00:00.000Z");

    const unlinked = await listTransactionsNotLinkedToAnyDebt(db);
    expect(unlinked.map((t) => t.id)).toEqual([freeTxId]);
  });
});
