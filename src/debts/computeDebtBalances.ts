export type DebtDirection = "lent" | "borrowed";
export type DebtStatus = "open" | "closed" | "forgiven";

export type Debt = {
  id: number;
  personId: number;
  direction: DebtDirection;
  amountTiyin: number; // principal, always positive
  occurredAt: string;
  dueDate: string | null;
  note: string | null;
  status: DebtStatus;
};

export type DebtRepayment = {
  id: number;
  debtId: number;
  amountTiyin: number; // always positive
  occurredAt: string;
};

export type DebtWithBalance = Omit<Debt, "status"> & {
  /** Derived, not trusted blindly from the stored column — a debt whose
   * repayments already cover the principal reads as "closed" here even if
   * nothing updated the DB row, 'forgiven' only comes from the stored
   * status since nothing else can derive it. */
  status: DebtStatus;
  remainingTiyin: number;
  repayments: DebtRepayment[];
  overdue: boolean;
};

export type PersonDebtSummary = {
  personId: number;
  personName: string;
  direction: DebtDirection;
  totalTiyin: number;
  remainingTiyin: number;
  since: string;
  overdue: boolean;
  debts: DebtWithBalance[];
};

/**
 * SPEC-2.md 8's core: per person × direction, the остаток/история/
 * просрочка the "Долги" screen shows. Remaining is derived purely from
 * principal − repayments (never doubts a repayment, never floors below
 * zero into negative "owed me money back" territory — an overpayment just
 * reads as closed, the excess is the caller's problem to notice elsewhere).
 */
export function computeDebtBalances(
  debts: readonly Debt[],
  repayments: readonly DebtRepayment[],
  people: readonly { id: number; name: string }[],
  now: Date = new Date(),
): PersonDebtSummary[] {
  const repaymentsByDebt = new Map<number, DebtRepayment[]>();
  for (const r of repayments) {
    const list = repaymentsByDebt.get(r.debtId) ?? [];
    list.push(r);
    repaymentsByDebt.set(r.debtId, list);
  }
  const peopleById = new Map(people.map((p) => [p.id, p.name]));
  const nowIso = now.toISOString();

  const withBalance: DebtWithBalance[] = debts.map((debt) => {
    const debtRepayments = (repaymentsByDebt.get(debt.id) ?? []).sort((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt),
    );
    const repaidTiyin = debtRepayments.reduce((sum, r) => sum + r.amountTiyin, 0);
    const remainingTiyin = Math.max(0, debt.amountTiyin - repaidTiyin);
    const status: DebtStatus = debt.status === "forgiven" ? "forgiven" : remainingTiyin === 0 ? "closed" : "open";
    const overdue = status === "open" && debt.dueDate !== null && debt.dueDate < nowIso;
    return { ...debt, status, remainingTiyin, repayments: debtRepayments, overdue };
  });

  const groups = new Map<string, DebtWithBalance[]>();
  for (const d of withBalance) {
    const key = `${d.personId}:${d.direction}`;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }

  const summaries: PersonDebtSummary[] = [];
  for (const [key, group] of groups) {
    const [personIdStr, direction] = key.split(":");
    const personId = Number(personIdStr);
    const sorted = [...group].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    summaries.push({
      personId,
      personName: peopleById.get(personId) ?? "?",
      direction: direction as DebtDirection,
      totalTiyin: group.reduce((sum, d) => sum + d.amountTiyin, 0),
      remainingTiyin: group.reduce((sum, d) => sum + d.remainingTiyin, 0),
      since: sorted[0].occurredAt,
      overdue: group.some((d) => d.overdue),
      debts: sorted,
    });
  }

  return summaries.sort((a, b) => b.remainingTiyin - a.remainingTiyin);
}
