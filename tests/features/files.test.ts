import { describe, expect, it } from "vitest";
import { formatGoldenMismatch } from "../../src/features/files/goldenMismatch";

describe("formatGoldenMismatch (SPEC-2.md 3.3 — show the size of the mismatch)", () => {
  it("reports the summary block's own discrepancy", () => {
    const text = formatGoldenMismatch({
      ok: false,
      expectedDelta: 100000,
      summaryDelta: 150000,
      transactionsDelta: 100000,
    });
    expect(text).toContain("итоговый блок расходится на");
    expect(text).not.toContain("сумма операций");
  });

  it("reports the transactions sum's own discrepancy", () => {
    const text = formatGoldenMismatch({
      ok: false,
      expectedDelta: 100000,
      summaryDelta: 100000,
      transactionsDelta: 90000,
    });
    expect(text).toContain("сумма операций расходится на");
    expect(text).not.toContain("итоговый блок");
  });

  it("reports both when both are off", () => {
    const text = formatGoldenMismatch({
      ok: false,
      expectedDelta: 100000,
      summaryDelta: 150000,
      transactionsDelta: 90000,
    });
    expect(text).toContain("итоговый блок");
    expect(text).toContain("сумма операций");
  });
});
