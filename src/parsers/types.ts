export type ForeignAmount = {
  currency: string;
  amountMinor: number;
};

export type ParsedTransaction = {
  occurredAt: string;
  amountTiyin: number;
  description: string;
  rawType: string;
  foreignAmount?: ForeignAmount;
};

export type TransactionSummary = {
  opening: number;
  closing: number;
  categories: Record<string, number>;
};

export type ParsedStatement = {
  bank: "kaspi";
  periodStart: string;
  periodEnd: string;
  transactions: ParsedTransaction[];
  summary: TransactionSummary;
};
