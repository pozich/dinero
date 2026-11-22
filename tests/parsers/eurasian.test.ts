import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEurasian } from "../../src/parsers/eurasian";
import { checkGolden } from "../../src/parsers/goldenCheck";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(here, "../../samples/bcc & ebank");
const hasSamples = fs.existsSync(SAMPLES_DIR);

// Golden numbers from each file's own "Arrival/Expense for the period" and
// "Available on" lines (SPEC.md 4.2); count cross-checked by hand against
// the full transaction list.
const FIXTURES = [
  { file: "eubank_oct.pdf", count: 26 },
  { file: "eubank_2025.pdf", count: 12 },
];

describe.skipIf(!hasSamples)("eurasian parser (golden)", () => {
  for (const fx of FIXTURES) {
    it(`${fx.file}: operation count and balance check match the statement`, async () => {
      const data = new Uint8Array(fs.readFileSync(path.join(SAMPLES_DIR, fx.file)));
      const statement = await parseEurasian(data);

      expect(statement.transactions).toHaveLength(fx.count);

      const golden = checkGolden(statement);
      expect(golden).toMatchObject({
        ok: true,
        summaryDelta: golden.expectedDelta,
        transactionsDelta: golden.expectedDelta,
      });
    });
  }

  it("eubank_oct.pdf: a transaction split across a page break is still one row", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(SAMPLES_DIR, "eubank_oct.pdf")),
    );
    const statement = await parseEurasian(data);
    // 22.05.2026: row1+row2 land at the bottom of page 2, row3 (time +
    // "replenishment") lands alone at the top of page 3.
    const replenishment = statement.transactions.find(
      (t) => t.occurredAt === "2026-05-22T00:00:00.000Z" && t.amountTiyin > 0,
    );
    expect(replenishment).toMatchObject({
      amountTiyin: 5237200,
      rawType: "Account replenishment",
    });
  });

  it("eubank_oct.pdf: outgoing transfers resolve the recipient, not just the bank", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(SAMPLES_DIR, "eubank_oct.pdf")),
    );
    const statement = await parseEurasian(data);
    const toBogdan = statement.transactions.filter((t) => t.description === "Богдан У.");
    expect(toBogdan.map((t) => t.amountTiyin).sort((a, b) => a - b)).toEqual([
      -8000000, -2000000, -1237200,
    ]);
  });
});
