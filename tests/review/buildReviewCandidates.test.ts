import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import { confirmTransferLink, rejectTransferLink } from "../../src/db/transferLinks";
import { buildReviewCandidates } from "../../src/review/buildReviewCandidates";

async function seed(db: ReturnType<typeof createTestDb>) {
  const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
  const halykId = await getAccountIdByKind(db, "halyk_salary");

  const transferFrom = await insertTransaction(db, {
    accountId: kaspiId,
    statementId: null,
    occurredAt: "2026-01-01T00:00:00.000Z",
    amountTiyin: -100000,
    description: "To Halyk Bank",
    rawType: "Transfers",
    dedupKey: "t1",
  });
  const transferTo = await insertTransaction(db, {
    accountId: halykId,
    statementId: null,
    occurredAt: "2026-01-02T00:00:00.000Z",
    amountTiyin: 100000,
    description: "Поступление перевода",
    rawType: "Поступление перевода",
    dedupKey: "t2",
  });

  const purchase = await insertTransaction(db, {
    accountId: kaspiId,
    statementId: null,
    occurredAt: "2026-02-01T00:00:00.000Z",
    amountTiyin: -50000,
    description: "KOYEB SERVERLESS CLOUD",
    rawType: "Purchases",
    dedupKey: "r1",
  });
  const refund = await insertTransaction(db, {
    accountId: kaspiId,
    statementId: null,
    occurredAt: "2026-02-01T00:00:00.000Z",
    amountTiyin: 50000,
    description: "KOYEB SERVERLESS CLOUD",
    rawType: "Purchases",
    dedupKey: "r2",
  });

  return { transferFrom, transferTo, purchase, refund };
}

describe("buildReviewCandidates", () => {
  it("finds both a transfer and a refund candidate", async () => {
    const db = createTestDb();
    const { transferFrom, transferTo, purchase, refund } = await seed(db);

    const candidates = await buildReviewCandidates(db);

    expect(
      candidates.some((c) => c.kind === "transfer" && c.from.id === transferFrom && c.to.id === transferTo),
    ).toBe(true);
    expect(
      candidates.some((c) => c.kind === "refund" && c.from.id === purchase && c.to.id === refund),
    ).toBe(true);
  });

  it("drops a pair once it's confirmed — both sides leave the pool entirely", async () => {
    const db = createTestDb();
    const { transferFrom, transferTo } = await seed(db);
    await confirmTransferLink(db, transferFrom, transferTo, "transfer");

    const candidates = await buildReviewCandidates(db);
    expect(candidates.some((c) => c.from.id === transferFrom || c.to.id === transferFrom)).toBe(false);
  });

  it("drops only the specific pair once rejected, not the transaction itself", async () => {
    const db = createTestDb();
    const { purchase, refund } = await seed(db);
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");

    // a second, equally-good refund candidate for the same purchase
    const altRefund = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-02-01T00:00:00.000Z",
      amountTiyin: 50000,
      description: "KOYEB SERVERLESS CLOUD",
      rawType: "Purchases",
      dedupKey: "r3",
    });

    await rejectTransferLink(db, purchase, refund, "refund");

    const candidates = await buildReviewCandidates(db);
    expect(candidates.some((c) => c.from.id === purchase && c.to.id === refund)).toBe(false);
    expect(candidates.some((c) => c.from.id === purchase && c.to.id === altRefund)).toBe(true);
  });
});
