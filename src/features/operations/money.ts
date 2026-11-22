const FORMATTER = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTiyin(amountTiyin: number): string {
  const sign = amountTiyin < 0 ? "-" : "+";
  const value = FORMATTER.format(Math.abs(amountTiyin) / 100).replace(/ /g, " ");
  return `${sign} ${value} ₸`;
}

export function parseTiyinInput(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
