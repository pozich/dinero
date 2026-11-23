import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseKaspi } from "../../src/parsers/kaspi";
import { parseHalyk } from "../../src/parsers/halyk";
import { findRefundCandidates, type MatchableRefundTransaction } from "../../src/transfers/refundMatch";

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesRoot = path.resolve(here, "../../samples");
const hasSamples = fs.existsSync(samplesRoot);

// Both real examples named in SPEC-2.md 3.2.
describe.skipIf(!hasSamples)("findRefundCandidates (real samples, SPEC-2.md 3.2)", () => {
  it("finds the KOYEB same-day full refund on Kaspi Gold", async () => {
    const statement = await parseKaspi(
      new Uint8Array(fs.readFileSync(path.join(samplesRoot, "Kaspi/kaspi_oct.pdf"))),
    );
    const all: MatchableRefundTransaction[] = statement.transactions.map((t) => ({
      ...t,
      accountKind: "kaspi_gold",
    }));

    const candidates = findRefundCandidates(all);
    const koyeb = candidates.filter((c) => all[c.purchaseIndex].description.includes("KOYEB"));
    expect(koyeb).toHaveLength(1);
    expect(koyeb[0].dateDiffDays).toBe(0);
    expect(all[koyeb[0].purchaseIndex].amountTiyin).toBe(-50500);
    expect(all[koyeb[0].refundIndex].amountTiyin).toBe(50500);
  });

  it("does NOT auto-match the OZON row (SPEC.md 4.2's own 'weird return row') — the refund (+13 485) is bigger than the purchase (-11 613), so it fails the refund ≤ purchase guard and needs the manual 'Связать как возврат' path instead", async () => {
    const statement = await parseHalyk(
      new Uint8Array(fs.readFileSync(path.join(samplesRoot, "Halyk/halyk_card_oct.pdf"))),
    );
    const all: MatchableRefundTransaction[] = statement.transactions.map((t) => ({
      ...t,
      accountKind: statement.accountKind,
    }));

    const candidates = findRefundCandidates(all);
    const ozon = candidates.filter((c) => all[c.purchaseIndex].description.includes("OZON"));
    expect(ozon).toHaveLength(0);
  });
});

describe("findRefundCandidates (synthetic edge cases)", () => {
  const base = {
    occurredAt: "2026-01-01T00:00:00.000Z",
    description: "Магазин",
  };

  it("never matches across different accounts", () => {
    const transactions: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000 },
      { ...base, accountKind: "halyk_salary", amountTiyin: 1000 },
    ];
    expect(findRefundCandidates(transactions)).toHaveLength(0);
  });

  it("never matches when descriptions differ, even normalized", () => {
    const transactions: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000, description: "Магазин А" },
      { ...base, accountKind: "kaspi_gold", amountTiyin: 1000, description: "Магазин Б" },
    ];
    expect(findRefundCandidates(transactions)).toHaveLength(0);
  });

  it("ignores case and surrounding whitespace in the description match", () => {
    const transactions: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000, description: "  Магазин  " },
      { ...base, accountKind: "kaspi_gold", amountTiyin: 1000, description: "магазин" },
    ];
    expect(findRefundCandidates(transactions)).toHaveLength(1);
  });

  it("never matches a refund that happened before the purchase", () => {
    const transactions: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000, occurredAt: "2026-01-10T00:00:00.000Z" },
      { ...base, accountKind: "kaspi_gold", amountTiyin: 1000, occurredAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(findRefundCandidates(transactions)).toHaveLength(0);
  });

  it("never matches a refund larger than the purchase", () => {
    const transactions: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000 },
      { ...base, accountKind: "kaspi_gold", amountTiyin: 1500 },
    ];
    expect(findRefundCandidates(transactions)).toHaveLength(0);
  });

  it("drops pairs further apart than maxDateDiffDays (default 14)", () => {
    const transactions: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000, occurredAt: "2026-01-01T00:00:00.000Z" },
      { ...base, accountKind: "kaspi_gold", amountTiyin: 1000, occurredAt: "2026-01-20T00:00:00.000Z" },
    ];
    expect(findRefundCandidates(transactions)).toHaveLength(0);
    expect(findRefundCandidates(transactions, { maxDateDiffDays: 30 })).toHaveLength(1);
  });

  it("a full refund scores higher than a partial one at the same date distance", () => {
    const full: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000 },
      { ...base, accountKind: "kaspi_gold", amountTiyin: 1000 },
    ];
    const partial: MatchableRefundTransaction[] = [
      { ...base, accountKind: "kaspi_gold", amountTiyin: -1000 },
      { ...base, accountKind: "kaspi_gold", amountTiyin: 700 },
    ];
    expect(findRefundCandidates(full)[0].confidence).toBeGreaterThan(
      findRefundCandidates(partial)[0].confidence,
    );
  });
});
