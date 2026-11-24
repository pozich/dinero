import { describe, expect, it } from "vitest";
import { computeDebtBalances, type Debt, type DebtRepayment } from "../../src/debts/computeDebtBalances";

const PEOPLE = [{ id: 1, name: "Роман" }, { id: 2, name: "Айгерім" }];

function debt(partial: Partial<Debt>): Debt {
  return {
    id: 1,
    personId: 1,
    direction: "lent",
    amountTiyin: 500000,
    occurredAt: "2026-01-01T00:00:00.000Z",
    dueDate: null,
    note: null,
    status: "open",
    ...partial,
  };
}

function repayment(partial: Partial<DebtRepayment>): DebtRepayment {
  return { id: 1, debtId: 1, amountTiyin: 100000, occurredAt: "2026-01-05T00:00:00.000Z", ...partial };
}

describe("computeDebtBalances", () => {
  it("closes a debt once repayments cover the whole principal (Ф7's own done-criterion)", () => {
    const debts = [debt({ amountTiyin: 500000 })];
    const repayments = [
      repayment({ id: 1, amountTiyin: 200000, occurredAt: "2026-01-05T00:00:00.000Z" }),
      repayment({ id: 2, amountTiyin: 300000, occurredAt: "2026-01-10T00:00:00.000Z" }),
    ];
    const [summary] = computeDebtBalances(debts, repayments, PEOPLE);
    expect(summary.remainingTiyin).toBe(0);
    expect(summary.debts[0].status).toBe("closed");
  });

  it("tracks a partial repayment's remaining balance", () => {
    const debts = [debt({ amountTiyin: 500000 })];
    const repayments = [repayment({ amountTiyin: 200000 })];
    const [summary] = computeDebtBalances(debts, repayments, PEOPLE);
    expect(summary.remainingTiyin).toBe(300000);
    expect(summary.debts[0].status).toBe("open");
  });

  it("keeps a forgiven debt's status regardless of its remaining balance", () => {
    const debts = [debt({ amountTiyin: 500000, status: "forgiven" })];
    const [summary] = computeDebtBalances(debts, [repayment({ amountTiyin: 500000 })], PEOPLE);
    expect(summary.debts[0].status).toBe("forgiven");
  });

  it("flags an open debt as overdue once its due date has passed", () => {
    const debts = [debt({ dueDate: "2026-01-01T00:00:00.000Z" })];
    const [summary] = computeDebtBalances(debts, [], PEOPLE, new Date("2026-02-01T00:00:00.000Z"));
    expect(summary.overdue).toBe(true);
  });

  it("doesn't flag a closed debt as overdue even past its due date", () => {
    const debts = [debt({ dueDate: "2026-01-01T00:00:00.000Z", amountTiyin: 500000 })];
    const repayments = [repayment({ amountTiyin: 500000 })];
    const [summary] = computeDebtBalances(debts, repayments, PEOPLE, new Date("2026-02-01T00:00:00.000Z"));
    expect(summary.overdue).toBe(false);
  });

  it("groups by person and direction separately", () => {
    const debts = [
      debt({ id: 1, personId: 1, direction: "lent" }),
      debt({ id: 2, personId: 1, direction: "borrowed" }),
      debt({ id: 3, personId: 2, direction: "lent" }),
    ];
    const summaries = computeDebtBalances(debts, [], PEOPLE);
    expect(summaries).toHaveLength(3);
  });

  it("sums several debts to the same person/direction into one summary", () => {
    const debts = [
      debt({ id: 1, amountTiyin: 100000, occurredAt: "2026-01-01T00:00:00.000Z" }),
      debt({ id: 2, amountTiyin: 200000, occurredAt: "2026-02-01T00:00:00.000Z" }),
    ];
    const [summary] = computeDebtBalances(debts, [], PEOPLE);
    expect(summary.totalTiyin).toBe(300000);
    expect(summary.remainingTiyin).toBe(300000);
    expect(summary.since).toBe("2026-01-01T00:00:00.000Z");
  });

  it("never lets an overpaying repayment push remaining below zero", () => {
    const debts = [debt({ amountTiyin: 500000 })];
    const [summary] = computeDebtBalances(debts, [repayment({ amountTiyin: 900000 })], PEOPLE);
    expect(summary.remainingTiyin).toBe(0);
  });
});
