import { useState } from "react";
import { getDb } from "../../db/client";
import { listSecurities } from "../../db/securities";
import { refreshPrices } from "../../db/securityPrices";
import { kasePriceSource } from "../../investments/kasePriceSource";

/** SPEC-2.md 9.2's «Обновить цены» — downloads only the days missing
 * since each security's last cached price, works entirely offline after
 * that. A failure for one ticker is shown but doesn't block the others. */
export function UpdatePricesButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const db = await getDb();
      const securities = await listSecurities(db);
      const results = await refreshPrices(db, kasePriceSource, securities.map((s) => ({ isin: s.isin, ticker: s.ticker })));
      const errors = results.filter((r) => r.error);
      const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);
      setMessage(
        errors.length > 0
          ? `Загружено ${totalFetched} цен. Ошибки: ${errors.map((e) => `${e.ticker} — ${e.error}`).join("; ")}`
          : totalFetched > 0
            ? `Загружено ${totalFetched} новых цен.`
            : "Цены уже актуальны.",
      );
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="update-prices">
      <button type="button" onClick={run} disabled={busy}>
        {busy ? "Обновляю..." : "Обновить цены"}
      </button>
      {message && <span className="hint">{message}</span>}
    </span>
  );
}
