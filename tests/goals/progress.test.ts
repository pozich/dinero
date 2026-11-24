import { describe, expect, it } from "vitest";
import { computeGoalCurrentTiyin, sumContributions, averageMonthlyContribution } from "../../src/goals/progress";

const DATA = { accountBalances: new Map([[1, 500000]]), envelopeContributionsTiyin: 200000, portfolioValueTiyin: 900000 };

describe("computeGoalCurrentTiyin", () => {
  it("reads an account goal's progress from its balance", () => {
    expect(computeGoalCurrentTiyin({ type: "account", accountId: 1 }, DATA)).toBe(500000);
  });

  it("falls back to zero for an account with no known balance", () => {
    expect(computeGoalCurrentTiyin({ type: "account", accountId: 999 }, DATA)).toBe(0);
  });

  it("reads an envelope goal's progress from its contribution total", () => {
    expect(computeGoalCurrentTiyin({ type: "envelope" }, DATA)).toBe(200000);
  });

  it("reads a portfolio goal's progress from the portfolio value", () => {
    expect(computeGoalCurrentTiyin({ type: "portfolio" }, DATA)).toBe(900000);
  });
});

describe("sumContributions", () => {
  it("nets a withdrawal (negative contribution) against deposits", () => {
    expect(sumContributions([{ amountTiyin: 100000 }, { amountTiyin: -40000 }])).toBe(60000);
  });

  it("is zero for no contributions", () => {
    expect(sumContributions([])).toBe(0);
  });
});

describe("averageMonthlyContribution", () => {
  const now = new Date("2026-04-01T00:00:00.000Z");

  it("averages only contributions within the trailing window", () => {
    const contributions = [
      { amountTiyin: 30000, occurredAt: "2026-02-01T00:00:00.000Z" },
      { amountTiyin: 30000, occurredAt: "2026-03-01T00:00:00.000Z" },
      { amountTiyin: 999999, occurredAt: "2024-01-01T00:00:00.000Z" }, // outside the 3-month window
    ];
    expect(averageMonthlyContribution(contributions, 3, now)).toBe(20000); // 60000/3
  });

  it("is zero when there are no contributions at all", () => {
    expect(averageMonthlyContribution([], 3, now)).toBe(0);
  });
});
