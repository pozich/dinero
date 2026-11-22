import type { ParsedTransaction } from "./types";

export type CashLink = {
  parentIndex: number;
  cashIndex: number;
};

const WITHDRAWAL_RE = /^Снятие денег без карты/;
const DEPOSIT_RE = /^Поступление на карту CASH TO CARD ATM/;

function isKaspiAtmDeposit(t: ParsedTransaction): boolean {
  return t.rawType === "Replenishment" && t.description === "At Kaspi ATM";
}

/**
 * The virtual "Наличные" account has no statement of its own (SPEC.md 4.1):
 * an ATM withdrawal/cash-in-deposit line on a real account is mirrored onto
 * it directly, the same way Kaspi Deposit moves are (6.3: "Снятие наличных
 * в банкомате ↔ приход на счёт «Наличные»; внесение в банкомат — наоборот").
 */
export function expandCashMirrors(transactions: ParsedTransaction[]): {
  mirrors: ParsedTransaction[];
  links: CashLink[];
} {
  const mirrors: ParsedTransaction[] = [];
  const links: CashLink[] = [];

  transactions.forEach((t, parentIndex) => {
    const isWithdrawal = WITHDRAWAL_RE.test(t.description);
    const isDeposit = DEPOSIT_RE.test(t.description) || isKaspiAtmDeposit(t);
    if (!isWithdrawal && !isDeposit) return;

    mirrors.push({
      occurredAt: t.occurredAt,
      amountTiyin: -t.amountTiyin,
      description: t.description,
      rawType: t.rawType,
    });
    links.push({ parentIndex, cashIndex: mirrors.length - 1 });
  });

  return { mirrors, links };
}
