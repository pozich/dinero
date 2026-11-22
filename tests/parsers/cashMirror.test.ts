import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHalyk } from "../../src/parsers/halyk";
import { parseKaspi } from "../../src/parsers/kaspi";
import { expandCashMirrors } from "../../src/parsers/cashMirror";

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesRoot = path.resolve(here, "../../samples");
const hasSamples = fs.existsSync(samplesRoot);

describe.skipIf(!hasSamples)("cash mirrors (Наличные, no statement of its own)", () => {
  it("halyk_card_oct.pdf: 5 ATM withdrawals + 1 cash-to-card deposit, signs flipped", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(samplesRoot, "Halyk/halyk_card_oct.pdf")),
    );
    const statement = await parseHalyk(data);
    const { mirrors, links } = expandCashMirrors(statement.transactions);

    expect(mirrors).toHaveLength(6);
    expect(links).toHaveLength(6);

    const deposit = mirrors.find((m) => m.description.startsWith("Поступление на карту"));
    expect(deposit?.amountTiyin).toBe(-43000000); // card got +430 000,00 ₸, cash leg is the mirror

    const withdrawal = mirrors.find((m) => m.description.includes("GREEN MALL"));
    expect(withdrawal?.amountTiyin).toBe(2300000); // card got -23 000,00 ₸

    for (const link of links) {
      expect(mirrors[link.cashIndex].amountTiyin).toBe(
        -statement.transactions[link.parentIndex].amountTiyin,
      );
    }
  });

  it("kaspi_oct.pdf: 'At Kaspi ATM' replenishments are cash-in, not a bank transfer", async () => {
    const data = new Uint8Array(fs.readFileSync(path.join(samplesRoot, "Kaspi/kaspi_oct.pdf")));
    const statement = await parseKaspi(data);
    const { mirrors } = expandCashMirrors(statement.transactions);

    expect(mirrors).toHaveLength(5);
    expect(mirrors.every((m) => m.amountTiyin < 0)).toBe(true); // cash spent to top up the card
  });
});
