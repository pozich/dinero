import type { ParsedTransaction } from "./types";

export type DepositLink = {
  kaspiGoldIndex: number;
  kaspiDepositIndex: number;
};

function isDepositMove(t: ParsedTransaction): boolean {
  return (
    (t.rawType === "Receipt from your account" || t.rawType === "Transfer to your account") &&
    t.description.includes("Kaspi Deposit")
  );
}

/**
 * Kaspi Gold shows moves to/from the (file-less) Kaspi Deposit account as a
 * single row. We mirror each such row onto a virtual "Kaspi Deposit" account
 * and link the two — see SPEC.md 4.3.
 */
export function expandKaspiDepositMirrors(transactions: ParsedTransaction[]): {
  mirrors: ParsedTransaction[];
  links: DepositLink[];
} {
  const mirrors: ParsedTransaction[] = [];
  const links: DepositLink[] = [];

  transactions.forEach((t, kaspiGoldIndex) => {
    if (!isDepositMove(t)) return;
    mirrors.push({
      occurredAt: t.occurredAt,
      amountTiyin: -t.amountTiyin,
      description: t.description,
      rawType: t.rawType,
    });
    links.push({ kaspiGoldIndex, kaspiDepositIndex: mirrors.length - 1 });
  });

  return { mirrors, links };
}
