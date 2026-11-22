import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseKaspi } from "../../src/parsers/kaspi";
import { checkGolden } from "../../src/parsers/goldenCheck";
import { expandKaspiDepositMirrors } from "../../src/parsers/kaspiDeposit";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(here, "../../samples/Kaspi");
const hasSamples = fs.existsSync(SAMPLES_DIR);

// Golden numbers computed independently from each file's own "Transaction
// summary" block (opening + sum(categories) == closing) and cross-checked
// against the sum of every parsed row — see SPEC.md 4.2. Real files are
// gitignored (4.4), so only these numbers are committed.
const FIXTURES = [
  { file: "kaspi_2023.pdf", count: 11, depositRows: 0 },
  { file: "kaspi_2024.pdf", count: 244, depositRows: 31 },
  { file: "kaspi_2025.pdf", count: 574, depositRows: 78 },
  { file: "kaspi_oct.pdf", count: 311, depositRows: 2 },
];

describe.skipIf(!hasSamples)("kaspi parser (golden)", () => {
  for (const fx of FIXTURES) {
    it(`${fx.file}: operation count and balance check match the statement`, async () => {
      const data = new Uint8Array(fs.readFileSync(path.join(SAMPLES_DIR, fx.file)));
      const statement = await parseKaspi(data);

      expect(statement.transactions).toHaveLength(fx.count);

      const golden = checkGolden(statement);
      expect(golden).toMatchObject({
        ok: true,
        summaryDelta: golden.expectedDelta,
        transactionsDelta: golden.expectedDelta,
      });

      const { mirrors, links } = expandKaspiDepositMirrors(statement.transactions);
      expect(mirrors).toHaveLength(fx.depositRows);
      expect(links).toHaveLength(fx.depositRows);
      for (const link of links) {
        expect(mirrors[link.kaspiDepositIndex].amountTiyin).toBe(
          -statement.transactions[link.kaspiGoldIndex].amountTiyin,
        );
      }
    });
  }

  it("kaspi_2023.pdf: a foreign-currency sub-line stays attached, not a new transaction", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(SAMPLES_DIR, "kaspi_2023.pdf")),
    );
    const statement = await parseKaspi(data);
    const withForeign = statement.transactions.filter((t) => t.foreignAmount);

    expect(withForeign).toHaveLength(2);
    expect(withForeign[0].foreignAmount).toEqual({ currency: "EUR", amountMinor: -1300 });
    expect(withForeign[1].foreignAmount).toEqual({ currency: "EUR", amountMinor: -100 });
  });

  it("kaspi_oct.pdf: a Purchases return (+/- same day) is kept as two separate rows", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(SAMPLES_DIR, "kaspi_oct.pdf")),
    );
    const statement = await parseKaspi(data);
    const koyeb = statement.transactions.filter((t) => t.description.includes("KOYEB"));

    expect(koyeb).toHaveLength(2);
    expect(koyeb.map((t) => t.amountTiyin).sort((a, b) => a - b)).toEqual([-50500, 50500]);
  });
});
