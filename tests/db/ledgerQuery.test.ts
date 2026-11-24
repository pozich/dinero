import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { findOrCreateCategory } from "../../src/db/categories";
import { insertTransaction, setTransactionCategory } from "../../src/db/transactions";
import { confirmTransferLink } from "../../src/db/transferLinks";
import { queryLedger } from "../../src/db/ledgerQuery";

describe("queryLedger", () => {
  it("nets a partial refund correctly even when a period filter would otherwise hide the refund side", async () => {
    const db = createTestDb();
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    const food = await findOrCreateCategory(db, "Еда");

    const purchaseId = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-08-15T00:00:00.000Z",
      amountTiyin: -100000,
      description: "Магазин",
      rawType: null,
      dedupKey: "p1",
    });
    await setTransactionCategory(db, purchaseId, food, -100000);

    const refundId = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-09-02T00:00:00.000Z", // next month — outside an August-only filter
      amountTiyin: 30000,
      description: "Возврат",
      rawType: null,
      dedupKey: "r1",
    });
    await setTransactionCategory(db, refundId, food, 30000);

    await confirmTransferLink(db, purchaseId, refundId, "refund");

    // Filtering to August only must still see the *residual* expense
    // (-700), not the full -1000, even though the refund row itself is
    // outside the filtered window.
    const augustRows = await queryLedger(db, {
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.999Z",
    });
    const purchaseRow = augustRows.find((r) => r.transactionId === purchaseId);
    expect(purchaseRow).toMatchObject({ excluded: false, amountTiyin: -70000 });
    expect(augustRows.find((r) => r.transactionId === refundId)).toBeUndefined();
  });

  it("excludes a confirmed transfer and a transit-account row from the default (unfiltered) query", async () => {
    const db = createTestDb();
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    const eurasianId = await getAccountIdByKind(db, "eurasian"); // transit
    const food = await findOrCreateCategory(db, "Еда");

    const outId = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -50000,
      description: "Перевод",
      rawType: null,
      dedupKey: "t1",
    });
    const inId = await insertTransaction(db, {
      accountId: eurasianId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: 50000,
      description: "Поступление",
      rawType: null,
      dedupKey: "t2",
    });
    await setTransactionCategory(db, outId, food, -50000);
    await confirmTransferLink(db, outId, inId, "transfer");

    const rows = await queryLedger(db);
    const outRow = rows.find((r) => r.transactionId === outId);
    const inRow = rows.find((r) => r.transactionId === inId);
    expect(outRow).toMatchObject({ excluded: true, reason: "transfer" });
    // inId is both the transit side and the transfer's other leg — transit
    // wins as the reported reason (checked first in computeLedger), but
    // it's excluded either way.
    expect(inRow).toMatchObject({ excluded: true, reason: "transit" });
  });

  it("excludes a debt's own transaction and its repayment", async () => {
    const db = createTestDb();
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");

    const personResult = await db.execute("INSERT INTO people (name) VALUES ($1)", ["Роман"]);
    const personId = personResult.lastInsertId!;

    const lentId = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -500000,
      description: "Роман П.",
      rawType: null,
      dedupKey: "d1",
    });
    const repaymentId = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-10T00:00:00.000Z",
      amountTiyin: 500000,
      description: "Роман П.",
      rawType: null,
      dedupKey: "d2",
    });

    const debtResult = await db.execute(
      "INSERT INTO debts (person_id, direction, transaction_id, amount_tiyin, occurred_at) VALUES ($1, 'lent', $2, 500000, $3)",
      [personId, lentId, "2026-01-01T00:00:00.000Z"],
    );
    await db.execute(
      "INSERT INTO debt_repayments (debt_id, transaction_id, amount_tiyin, occurred_at) VALUES ($1, $2, 500000, $3)",
      [debtResult.lastInsertId, repaymentId, "2026-01-10T00:00:00.000Z"],
    );

    const rows = await queryLedger(db);
    expect(rows.find((r) => r.transactionId === lentId)).toMatchObject({ excluded: true, reason: "debt" });
    expect(rows.find((r) => r.transactionId === repaymentId)).toMatchObject({ excluded: true, reason: "debt" });
  });

  it("still counts an uncategorized transaction (no splits at all) toward the total, as «без категории»", async () => {
    const db = createTestDb();
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");

    const id = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -42000,
      description: "Ещё не разобрано",
      rawType: null,
      dedupKey: "u1",
    });

    const rows = await queryLedger(db);
    const row = rows.find((r) => r.transactionId === id);
    expect(row).toMatchObject({ excluded: false, amountTiyin: -42000, categoryId: null });
  });
});
