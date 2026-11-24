import { describe, expect, it } from "vitest";
import { findRepaymentCandidates, type DebtForMatching, type MatchableDebtTransaction } from "../../src/debts/findRepaymentCandidates";

function debt(partial: Partial<DebtForMatching>): DebtForMatching {
  return {
    id: 1,
    direction: "lent",
    personAliases: ["Роман П."],
    remainingTiyin: 500000,
    occurredAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function tx(partial: Partial<MatchableDebtTransaction>): MatchableDebtTransaction {
  return {
    id: 1,
    occurredAt: "2026-01-10T00:00:00.000Z",
    amountTiyin: 500000,
    description: "Роман П.",
    ...partial,
  };
}

describe("findRepaymentCandidates", () => {
  it("matches an incoming transfer from the same person as a repayment of money lent", () => {
    const candidates = findRepaymentCandidates([debt({})], [tx({})]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ debtId: 1, transactionId: 1 });
  });

  it("requires the opposite sign for a borrowed debt's repayment", () => {
    const borrowed = debt({ direction: "borrowed" });
    expect(findRepaymentCandidates([borrowed], [tx({ amountTiyin: 500000 })])).toHaveLength(0);
    expect(findRepaymentCandidates([borrowed], [tx({ amountTiyin: -500000 })])).toHaveLength(1);
  });

  it("rejects a transaction from a different person", () => {
    const candidates = findRepaymentCandidates([debt({})], [tx({ description: "Айгерім Т." })]);
    expect(candidates).toHaveLength(0);
  });

  it("rejects a transaction dated before the debt started", () => {
    const candidates = findRepaymentCandidates([debt({})], [tx({ occurredAt: "2025-12-01T00:00:00.000Z" })]);
    expect(candidates).toHaveLength(0);
  });

  it("rejects an amount larger than what's still owed", () => {
    const candidates = findRepaymentCandidates([debt({ remainingTiyin: 100000 })], [tx({ amountTiyin: 500000 })]);
    expect(candidates).toHaveLength(0);
  });

  it("accepts a partial repayment with lower confidence than a full one", () => {
    const full = findRepaymentCandidates([debt({ remainingTiyin: 500000 })], [tx({ amountTiyin: 500000 })]);
    const partial = findRepaymentCandidates([debt({ remainingTiyin: 500000 })], [tx({ amountTiyin: 200000 })]);
    expect(full[0].confidence).toBeGreaterThan(partial[0].confidence);
  });

  it("matches any of a person's known aliases", () => {
    const d = debt({ personAliases: ["Роман П.", "Роман Б."] });
    const candidates = findRepaymentCandidates([d], [tx({ description: "Роман Б." })]);
    expect(candidates).toHaveLength(1);
  });

  it("skips a debt that's already fully repaid", () => {
    const candidates = findRepaymentCandidates([debt({ remainingTiyin: 0 })], [tx({})]);
    expect(candidates).toHaveLength(0);
  });

  it("sorts by confidence, highest first", () => {
    const debts = [debt({ id: 1, occurredAt: "2026-01-01T00:00:00.000Z" })];
    const far = tx({ id: 10, occurredAt: "2026-03-01T00:00:00.000Z" });
    const near = tx({ id: 20, occurredAt: "2026-01-02T00:00:00.000Z" });
    const candidates = findRepaymentCandidates(debts, [far, near]);
    expect(candidates[0].transactionId).toBe(20);
  });
});
