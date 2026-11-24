import { describe, expect, it } from "vitest";
import { simulateDeposit, simulateIndex } from "../../src/investments/whatIf";

describe("simulateDeposit", () => {
  it("compounds a single cash flow over exactly one year at the given rate", () => {
    const result = simulateDeposit([{ date: "2025-01-01", amountTiyin: 1000000 }], 10, "2026-01-01");
    expect(result).toBeCloseTo(1100000, -2); // within rounding
  });

  it("gives later cash flows less time to grow", () => {
    const early = simulateDeposit([{ date: "2025-01-01", amountTiyin: 1000000 }], 10, "2026-01-01");
    const late = simulateDeposit([{ date: "2025-06-01", amountTiyin: 1000000 }], 10, "2026-01-01");
    expect(late).toBeLessThan(early);
  });

  it("sums multiple cash flows independently", () => {
    const combined = simulateDeposit(
      [
        { date: "2025-01-01", amountTiyin: 1000000 },
        { date: "2025-01-01", amountTiyin: 500000 },
      ],
      10,
      "2026-01-01",
    );
    const single = simulateDeposit([{ date: "2025-01-01", amountTiyin: 1500000 }], 10, "2026-01-01");
    expect(combined).toBe(single);
  });

  it("doesn't grow a cash flow dated after the as-of date", () => {
    const result = simulateDeposit([{ date: "2026-06-01", amountTiyin: 1000000 }], 10, "2026-01-01");
    expect(result).toBe(1000000);
  });
});

describe("simulateIndex", () => {
  const prices: Record<string, number> = { "2025-01-01": 100, "2026-01-01": 150 };
  const priceOnOrBefore = (date: string) => prices[date] ?? null;

  it("scales a cash flow by the index's growth ratio", () => {
    const result = simulateIndex([{ date: "2025-01-01", amountTiyin: 1000000 }], priceOnOrBefore, "2026-01-01");
    expect(result).toBe(1500000); // 100 -> 150 is +50%
  });

  it("returns null when the end-date price is missing", () => {
    expect(simulateIndex([{ date: "2025-01-01", amountTiyin: 1000000 }], priceOnOrBefore, "2030-01-01")).toBeNull();
  });

  it("skips a cash flow whose own price is missing instead of failing the whole simulation", () => {
    const result = simulateIndex(
      [
        { date: "2025-01-01", amountTiyin: 1000000 },
        { date: "1999-01-01", amountTiyin: 500000 }, // no price that far back
      ],
      priceOnOrBefore,
      "2026-01-01",
    );
    expect(result).toBe(1500000);
  });
});
