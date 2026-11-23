import { describe, expect, it } from "vitest";
import { findMergeCandidates, type MatchableTransaction } from "../../src/import/mergeManualCandidates";

describe("findMergeCandidates", () => {
  const manual: MatchableTransaction = {
    id: 1,
    accountKind: "cash",
    occurredAt: "2026-01-05T00:00:00.000Z",
    amountTiyin: -150000,
  };

  it("matches same account, same amount, same day", () => {
    const imported: MatchableTransaction = { id: 2, accountKind: "cash", occurredAt: "2026-01-05T00:00:00.000Z", amountTiyin: -150000 };
    const candidates = findMergeCandidates([manual], [imported]);
    expect(candidates).toEqual([{ manualId: 1, importedId: 2, dateDiffDays: 0 }]);
  });

  it("matches within 1 day either direction", () => {
    const dayBefore: MatchableTransaction = { id: 2, accountKind: "cash", occurredAt: "2026-01-04T00:00:00.000Z", amountTiyin: -150000 };
    const dayAfter: MatchableTransaction = { id: 3, accountKind: "cash", occurredAt: "2026-01-06T00:00:00.000Z", amountTiyin: -150000 };
    expect(findMergeCandidates([manual], [dayBefore])).toHaveLength(1);
    expect(findMergeCandidates([manual], [dayAfter])).toHaveLength(1);
  });

  it("never matches a different account", () => {
    const imported: MatchableTransaction = { id: 2, accountKind: "kaspi_gold", occurredAt: "2026-01-05T00:00:00.000Z", amountTiyin: -150000 };
    expect(findMergeCandidates([manual], [imported])).toHaveLength(0);
  });

  it("never matches a different amount", () => {
    const imported: MatchableTransaction = { id: 2, accountKind: "cash", occurredAt: "2026-01-05T00:00:00.000Z", amountTiyin: -150001 };
    expect(findMergeCandidates([manual], [imported])).toHaveLength(0);
  });

  it("never matches more than maxDateDiffDays apart", () => {
    const imported: MatchableTransaction = { id: 2, accountKind: "cash", occurredAt: "2026-01-10T00:00:00.000Z", amountTiyin: -150000 };
    expect(findMergeCandidates([manual], [imported])).toHaveLength(0);
  });
});
