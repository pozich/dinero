import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHalyk } from "../../src/parsers/halyk";
import { checkGolden } from "../../src/parsers/goldenCheck";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(here, "../../samples/Halyk");
const hasSamples = fs.existsSync(SAMPLES_DIR);

// Golden numbers from each file's own "Всего:" totals and opening/closing
// balance (SPEC.md 4.2); cross-checked by independently counting
// DD.MM.YYYY-prefixed rows with pdftotext.
const FIXTURES = [
  {
    file: "halyk_card_oct.pdf",
    accountKind: "halyk_salary",
    count: 74,
    feesCount: 0,
  },
  {
    file: "halyk_invest_oct.pdf",
    accountKind: "halyk_standard",
    count: 76,
    feesCount: 36,
  },
] as const;

describe.skipIf(!hasSamples)("halyk parser (golden)", () => {
  for (const fx of FIXTURES) {
    it(`${fx.file}: account kind, operation count and balance check match the statement`, async () => {
      const data = new Uint8Array(fs.readFileSync(path.join(SAMPLES_DIR, fx.file)));
      const statement = await parseHalyk(data);

      expect(statement.accountKind).toBe(fx.accountKind);
      expect(statement.transactions).toHaveLength(fx.count);
      expect(statement.fees).toHaveLength(fx.feesCount);

      // the commission is accounted separately from Приход/Расход, so the
      // golden check needs transactions + fees together (see SPEC.md 4.2/5).
      const golden = checkGolden({
        summary: statement.summary,
        transactions: [...statement.transactions, ...statement.fees],
      });
      expect(golden).toMatchObject({
        ok: true,
        summaryDelta: golden.expectedDelta,
        transactionsDelta: golden.expectedDelta,
      });

      for (const link of statement.feeLinks) {
        expect(statement.fees[link.feeIndex]).toBeDefined();
        expect(statement.transactions[link.parentIndex]).toBeDefined();
      }
    });
  }

  it("halyk_card_oct.pdf: multi-line description is glued into one string", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(SAMPLES_DIR, "halyk_card_oct.pdf")),
    );
    const statement = await parseHalyk(data);
    const goldenCorona = statement.transactions.find((t) =>
      t.description.includes("RRN: ZK0338210195"),
    );
    expect(goldenCorona?.description).toBe(
      "Перевод с карты Золотая корона Золотая Корона Homebank. Отправка перевода №935627333, страна получения: Россия (Российская Федерация), адрес получателя: АЗОВ (РОСТОВСКАЯ ОБЛ.), RRN: ZK0338210195",
    );
  });

  it("halyk_card_oct.pdf: the OZON return row trusts Приход/Расход, not Сумма операции", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(SAMPLES_DIR, "halyk_card_oct.pdf")),
    );
    const statement = await parseHalyk(data);
    const ozonPair = statement.transactions.filter(
      (t) => t.occurredAt === "2025-08-12T00:00:00.000Z" && t.description.includes("OZON"),
    );
    expect(ozonPair.map((t) => t.amountTiyin)).toEqual([1348500, -1161300]);
  });

  it("halyk_invest_oct.pdf: a multi-tranche broker sale stays as separate rows", async () => {
    const data = new Uint8Array(
      fs.readFileSync(path.join(SAMPLES_DIR, "halyk_invest_oct.pdf")),
    );
    const statement = await parseHalyk(data);
    const tranches = statement.transactions.filter((t) =>
      t.description.includes("SP0001349122"),
    );
    expect(tranches).toHaveLength(7);
    expect(tranches.reduce((a, t) => a + t.amountTiyin, 0)).toBe(5998655);
  });
});
