import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHalyk } from "../../src/parsers/halyk";
import { parseKaspi } from "../../src/parsers/kaspi";
import { parseEurasian } from "../../src/parsers/eurasian";
import {
  findTransferCandidates,
  type MatchableTransaction,
} from "../../src/transfers/matchTransfers";

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesRoot = path.resolve(here, "../../samples");
const hasSamples = fs.existsSync(samplesRoot);

function has(
  candidates: ReturnType<typeof findTransferCandidates>,
  all: MatchableTransaction[],
  fromAccount: string,
  fromAmount: number,
  toAccount: string,
  toAmount: number,
  date: string,
): boolean {
  return candidates.some((c) => {
    const from = all[c.fromIndex];
    const to = all[c.toIndex];
    return (
      from.accountKind === fromAccount &&
      from.amountTiyin === fromAmount &&
      from.occurredAt.startsWith(date) &&
      to.accountKind === toAccount &&
      to.amountTiyin === toAmount
    );
  });
}

// Every pair below is a real transfer listed in SPEC.md 4.3, reconstructed
// from the actual overlapping Kaspi/Halyk/Eurasian sample statements.
describe.skipIf(!hasSamples)("findTransferCandidates (own-account transfers, SPEC.md 4.3)", () => {
  it("finds every documented cross-bank and cross-account pair with high confidence", async () => {
    const kaspi = await parseKaspi(
      new Uint8Array(fs.readFileSync(path.join(samplesRoot, "Kaspi/kaspi_oct.pdf"))),
    );
    const halykSalary = await parseHalyk(
      new Uint8Array(fs.readFileSync(path.join(samplesRoot, "Halyk/halyk_card_oct.pdf"))),
    );
    const halykStandard = await parseHalyk(
      new Uint8Array(fs.readFileSync(path.join(samplesRoot, "Halyk/halyk_invest_oct.pdf"))),
    );
    const eurasian = await parseEurasian(
      new Uint8Array(
        fs.readFileSync(path.join(samplesRoot, "bcc & ebank/eubank_oct.pdf")),
      ),
    );

    const all: MatchableTransaction[] = [
      ...kaspi.transactions.map((t) => ({ ...t, accountKind: "kaspi_gold" })),
      ...halykSalary.transactions.map((t) => ({ ...t, accountKind: "halyk_salary" })),
      ...halykStandard.transactions.map((t) => ({ ...t, accountKind: "halyk_standard" })),
      ...eurasian.transactions.map((t) => ({ ...t, accountKind: "eurasian" })),
    ];

    const candidates = findTransferCandidates(all);

    // Kaspi -15 000 "To card Halyk Bank*4787" (23.04.26) <-> Halyk +15 000
    expect(has(candidates, all, "kaspi_gold", -1500000, "halyk_salary", 1500000, "2026-04-23")).toBe(
      true,
    );
    // Kaspi -4 000 (24.04.26) <-> Halyk +4 000 — the transfer fee (-200) is separate and unmatched
    expect(has(candidates, all, "kaspi_gold", -400000, "halyk_salary", 400000, "2026-04-24")).toBe(
      true,
    );
    // Eurasian -80 000 "Богдан У." (31.07.26) <-> Kaspi +80 000 "..., Eurasian Bank"
    expect(has(candidates, all, "eurasian", -8000000, "kaspi_gold", 8000000, "2026-07-31")).toBe(
      true,
    );
    // Eurasian -32 372 "Halyk Bank" (24.10.26) <-> Halyk salary +32 372 (проведение 24.10)
    expect(
      has(candidates, all, "eurasian", -3237200, "halyk_salary", 3237200, "2026-10-24"),
    ).toBe(true);
    // Halyk salary -32 372 "Перевод на другую карту" (25.10.26) <-> Halyk standard +32 372
    expect(
      has(candidates, all, "halyk_salary", -3237200, "halyk_standard", 3237200, "2026-10-25"),
    ).toBe(true);

    const commissionIndex = all.findIndex((t) =>
      t.description.includes("Commission for transfer"),
    );
    expect(candidates.some((c) => c.fromIndex === commissionIndex)).toBe(false);
  });

  it("never suggests a transfer within the same account", () => {
    const sameAccount: MatchableTransaction[] = [
      { accountKind: "kaspi_gold", occurredAt: "2026-01-01T00:00:00.000Z", amountTiyin: -1000, description: "a" },
      { accountKind: "kaspi_gold", occurredAt: "2026-01-01T00:00:00.000Z", amountTiyin: 1000, description: "b" },
    ];
    expect(findTransferCandidates(sameAccount)).toHaveLength(0);
  });

  it("drops pairs further apart than maxDateDiffDays", () => {
    const farApart: MatchableTransaction[] = [
      { accountKind: "a", occurredAt: "2026-01-01T00:00:00.000Z", amountTiyin: -1000, description: "x" },
      { accountKind: "b", occurredAt: "2026-01-10T00:00:00.000Z", amountTiyin: 1000, description: "y" },
    ];
    expect(findTransferCandidates(farApart)).toHaveLength(0);
    expect(findTransferCandidates(farApart, { maxDateDiffDays: 30 })).toHaveLength(1);
  });
});
