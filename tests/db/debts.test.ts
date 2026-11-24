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
} from "../../src/db/debts";
import { queryTransactions } from "../../src/db/transactionsQuery";
import { findOrCreateCategory } from "../../src/db/categories";

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
