import { useCallback, useEffect, useMemo, useState } from "react";
import { getDb } from "../../db/client";
import { queryInvestmentsOverview, type InvestmentsOverview } from "../../db/investmentsOverview";
import { listPrices } from "../../db/securityPrices";
import { computeFifo, type FifoTrade } from "../../investments/fifo";
import { UpdatePricesButton } from "./UpdatePricesButton";
import { UploadSnapshotButton } from "./UploadSnapshotButton";
import { PositionsTable } from "./PositionsTable";
import { StockChart } from "./StockChart";
import { PlayedCards } from "./PlayedCards";
import { PortfolioOverview } from "./PortfolioOverview";
import { DividendsCalendar } from "./DividendsCalendar";
import { TradeHistoryTable } from "./TradeHistoryTable";

type SubView = "positions" | "chart" | "portfolio" | "dividends" | "history";

const SUB_VIEWS: { id: SubView; label: string }[] = [
  { id: "positions", label: "Позиции" },
  { id: "chart", label: "График" },
  { id: "portfolio", label: "Портфель" },
  { id: "dividends", label: "Дивиденды" },
  { id: "history", label: "История" },
];

export function InvestmentsScreen() {
  const [overview, setOverview] = useState<InvestmentsOverview | null>(null);
  const [subView, setSubView] = useState<SubView>("positions");
  const [selectedIsin, setSelectedIsin] = useState<string | null>(null);
  const [prices, setPrices] = useState<{ date: string; closeTiyin: number }[]>([]);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const next = await queryInvestmentsOverview(db);
    setOverview(next);
    if (!selectedIsin && next.positions[0]) setSelectedIsin(next.positions[0].isin);
  }, [selectedIsin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedIsin) {
      setPrices([]);
      return;
    }
    getDb()
      .then((db) => listPrices(db, selectedIsin))
      .then(setPrices);
  }, [selectedIsin]);

  const selectedPosition = useMemo(
    () => overview?.positions.find((p) => p.isin === selectedIsin) ?? null,
    [overview, selectedIsin],
  );
  const selectedTrades = useMemo(
    () => overview?.trades.filter((t) => t.isin === selectedIsin) ?? [],
    [overview, selectedIsin],
  );
  const selectedDividends = useMemo(
    () => overview?.dividends.filter((d) => d.isin === selectedIsin) ?? [],
    [overview, selectedIsin],
  );
  const selectedFifo = useMemo(() => {
    const fifoTrades: FifoTrade[] = selectedTrades
      .filter((t): t is typeof t & { estimatedQuantity: number } => t.estimatedQuantity !== null)
      .map((t) => ({ id: t.id, side: t.side, date: t.occurredAt, quantity: t.estimatedQuantity, amountTiyin: t.amountTiyin, commissionTiyin: t.commissionTiyin }));
    return computeFifo(fifoTrades);
  }, [selectedTrades]);

  const discrepancies = overview?.goldenCheck.filter((g) => g.discrepancy !== 0) ?? [];

  if (!overview) {
    return (
      <div className="screen">
        <p className="hint">Загрузка инвестиций...</p>
      </div>
    );
  }

  return (
    <div className="screen investments-screen">
      <div className="analytics-header">
        <h2>Инвестиции</h2>
        <div className="investments-toolbar">
          <UpdatePricesButton onDone={refresh} />
          <UploadSnapshotButton onImported={refresh} />
        </div>
      </div>

      {discrepancies.length > 0 && (
        <div className="banner banner-warning">
          ⚠ Расхождение сделок со снимком на {discrepancies.length} строк (сумма:{" "}
          {discrepancies.reduce((sum, d) => sum + Math.abs(d.discrepancy), 0)} шт.) — оценка количества по цене
          неточна, возможно нужна более точная цена исполнения.
        </div>
      )}

      <div className="analytics-mode-switch">
        {SUB_VIEWS.map((v) => (
          <button key={v.id} type="button" className={v.id === subView ? "active" : ""} onClick={() => setSubView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {subView === "positions" && (
        <PositionsTable positions={overview.positions} selectedIsin={selectedIsin} onSelect={setSelectedIsin} />
      )}

      {subView === "chart" && (
        <>
          <select value={selectedIsin ?? ""} onChange={(e) => setSelectedIsin(e.target.value)}>
            {overview.positions.map((p) => (
              <option key={p.isin} value={p.isin}>
                {p.ticker}
              </option>
            ))}
          </select>
          <StockChart
            prices={prices}
            trades={selectedTrades}
            dividends={selectedDividends}
            averageCostTiyin={selectedPosition?.averageCostTiyin ?? 0}
          />
          {selectedPosition && <PlayedCards position={selectedPosition} fifo={selectedFifo} prices={prices} />}
        </>
      )}

      {subView === "portfolio" && <PortfolioOverview positions={overview.positions} trades={overview.trades} />}

      {subView === "dividends" && <DividendsCalendar dividends={overview.dividends} positions={overview.positions} />}

      {subView === "history" && <TradeHistoryTable trades={overview.trades} />}
    </div>
  );
}
