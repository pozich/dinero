import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBcc } from "../../src/parsers/bcc";
import { checkGolden } from "../../src/parsers/goldenCheck";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(here, "../../samples/bcc & ebank");
const hasSamples = fs.existsSync(SAMPLES_DIR);

describe.skipIf(!hasSamples)("bcc parser (golden)", () => {
  it("bcc.pdf: operation count and balance check match the statement", async () => {
    const data = new Uint8Array(fs.readFileSync(path.join(SAMPLES_DIR, "bcc.pdf")));
    const statement = await parseBcc(data);

    expect(statement.transactions).toHaveLength(27);
    expect(statement.periodStart).toBe("2024-09-18T00:00:00.000Z");
    expect(statement.periodEnd).toBe("2026-10-08T00:00:00.000Z");

    const golden = checkGolden(statement);
    expect(golden).toMatchObject({
      ok: true,
      summaryDelta: golden.expectedDelta,
      transactionsDelta: golden.expectedDelta,
    });
  });

  it("bcc.pdf: a wrapped description is glued into one string", async () => {
    const data = new Uint8Array(fs.readFileSync(path.join(SAMPLES_DIR, "bcc.pdf")));
    const statement = await parseBcc(data);
    const withdrawal = statement.transactions.find(
      (t) => t.occurredAt === "2024-10-27T00:00:00.000Z",
    );
    expect(withdrawal?.description).toBe("Transfer via ATM to card");
  });
});
