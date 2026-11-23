import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import {
  confirmTransferLink,
  rejectTransferLink,
  unlinkTransferLink,
  listConfirmedTransactionIds,
  listRejectedPairs,
  listConfirmedLinksForTransaction,
  pairKey,
} from "../../src/db/transferLinks";

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey(1, 2)).toBe(pairKey(2, 1));
    expect(pairKey(1, 2)).not.toBe(pairKey(1, 3));
  });
});

describe("transferLinks", () => {
  async function seedPair(db: ReturnType<typeof createTestDb>) {
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    const halykId = await getAccountIdByKind(db, "halyk_salary");
    const from = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -100000,
      description: "To Halyk",
      rawType: "Transfers",
      dedupKey: "a1",
    });
    const to = await insertTransaction(db, {
      accountId: halykId,
      statementId: null,
      occurredAt: "2026-01-02T00:00:00.000Z",
      amountTiyin: 100000,
      description: "Поступление",
      rawType: "Поступление перевода",
      dedupKey: "a2",
    });
    return { from, to };
  }

  it("confirmTransferLink marks both transactions as decided", async () => {
    const db = createTestDb();
    const { from, to } = await seedPair(db);
    await confirmTransferLink(db, from, to, "transfer");

    const confirmed = await listConfirmedTransactionIds(db);
    expect(confirmed.has(from)).toBe(true);
    expect(confirmed.has(to)).toBe(true);
  });

  it("rejectTransferLink remembers the pair without excluding the transactions themselves", async () => {
    const db = createTestDb();
    const { from, to } = await seedPair(db);
    await rejectTransferLink(db, from, to, "transfer");

    const rejected = await listRejectedPairs(db);
    expect(rejected.has(pairKey(from, to))).toBe(true);

    const confirmed = await listConfirmedTransactionIds(db);
    expect(confirmed.has(from)).toBe(false);
    expect(confirmed.has(to)).toBe(false);
  });

  it("unlinkTransferLink removes a confirmed link", async () => {
    const db = createTestDb();
    const { from, to } = await seedPair(db);
    const id = await confirmTransferLink(db, from, to, "transfer");

    expect(await listConfirmedLinksForTransaction(db, from)).toHaveLength(1);
    await unlinkTransferLink(db, id);
    expect(await listConfirmedLinksForTransaction(db, from)).toHaveLength(0);
  });
});
