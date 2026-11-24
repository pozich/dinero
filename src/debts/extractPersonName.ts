const BANK_SUFFIX = /,\s*.+$/u;
const NAME_PATTERN = /^(?:[\p{Lu}][\p{Ll}]+|[\p{Lu}]{2,})\s[\p{Lu}]\.$/u;

/**
 * SPEC-2.md 8: pulls a counterparty's name out of a transfer description.
 * For Kaspi specifically, a P2P transfer's description field *is* just the
 * other person's name ("Роман П.", "Айгерім Т."), sometimes with a
 * ", <bank name>" suffix when the transfer crossed banks ("Азалия С., Bank
 * CenterCredit", "УРУНБАЕВ Б., Eurasian Bank") — stripped first so the same
 * person's transfers from different banks still collapse to one alias.
 * `\p{Lu}`/`\p{Ll}` (not a hardcoded Cyrillic/Kazakh letter list) so this
 * doesn't need updating for every alphabet variant a bank's PDF export
 * happens to use (e.g. Kaspi renders Kazakh Ә as the Latin Schwa Ə).
 *
 * Deliberately conservative: only "Имя И." (name + a single capitalized
 * initial + ".") counts as a confident match — real statements also have
 * bare first names with no initial ("Айша", "Нур"), indistinguishable here
 * from a small shop's name, so those are left for the user to name by hand
 * rather than guessed.
 */
export function extractPersonName(description: string): string | null {
  const withoutBankSuffix = description.replace(BANK_SUFFIX, "");
  return NAME_PATTERN.test(withoutBankSuffix) ? withoutBankSuffix : null;
}
