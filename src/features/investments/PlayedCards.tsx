import { useState } from "react";
import type { Position } from "../../investments/computePositions";
import type { FifoResult } from "../../investments/fifo";
import { computeTimingPercent } from "../../investments/timing";
import { simulateDeposit } from "../../investments/whatIf";
import { formatTiyin } from "../operations/money";

function monthAveragePriceTiyin(prices: readonly { date: string; closeTiyin: number }[], month: string): number | null {
  const inMonth = prices.filter((p) => p.date.startsWith(month));
  if (inMonth.length === 0) return null;
  return Math.round(inMonth.reduce((sum, p) => sum + p.closeTiyin, 0) / inMonth.length);
}

/**
 * SPEC-2.md 9.3's «Как я сыграл»: текущий и полный результат, реализованный
 * результат по проданным ("сейчас стоило бы"), тайминг покупок против
 * месячного среднего, и «а если бы на депозит». The index ("...и в индекс
 * KASE") half is deliberately not built — no index price source is wired
 * up yet, see HANDOFF.md.
 */
export function PlayedCards({
  position,
  fifo,
  prices,
}: {
  position: Position;
  fifo: FifoResult;
  prices: readonly { date: string; closeTiyin: number }[];
}) {
  const [depositRatePercent, setDepositRatePercent] = useState(14);

  const fullResultTiyin = (position.pnlTiyin ?? 0) + position.dividendsReceivedTiyin;

  const openLotCashFlows = fifo.openLots.map((lot) => ({ date: lot.date, amountTiyin: lot.quantity * lot.unitCostTiyin }));
  const depositValueTiyin =
    openLotCashFlows.length > 0 ? simulateDeposit(openLotCashFlows, depositRatePercent, new Date().toISOString()) : null;

  return (
    <div className="played-cards">
      <div className="played-card">
        <h4>Сейчас</h4>
        <p>
          Вложено {formatTiyin(position.investedTiyin)} → стоит{" "}
          {position.currentValueTiyin !== null ? formatTiyin(position.currentValueTiyin) : "—"}
        </p>
        <p className={position.pnlTiyin !== null && position.pnlTiyin < 0 ? "metric-expense" : "metric-income"}>
          {position.pnlTiyin !== null
            ? `${formatTiyin(position.pnlTiyin)} (${position.pnlPercent?.toFixed(1)}%)`
            : "нет текущей цены"}
        </p>
      </div>

      <div className="played-card">
        <h4>Полный результат</h4>
        <p className="hint">Рост цены + дивиденды (комиссии уже учтены в средней цене)</p>
        <p className={fullResultTiyin < 0 ? "metric-expense" : "metric-income"}>{formatTiyin(fullResultTiyin)}</p>
      </div>

      {fifo.sells.length > 0 && (
        <div className="played-card">
          <h4>По проданным (FIFO)</h4>
          {fifo.sells.map((s) => {
            const wouldBeWorthNow =
              position.currentPriceTiyin !== null ? s.quantitySold * position.currentPriceTiyin : null;
            return (
              <p key={s.tradeId}>
                продано {s.quantitySold} шт.: результат{" "}
                <span className={s.realizedPnlTiyin < 0 ? "metric-expense" : "metric-income"}>
                  {formatTiyin(s.realizedPnlTiyin)}
                </span>
                {wouldBeWorthNow !== null && (
                  <span className="hint">
                    {" "}
                    · сейчас стоило бы {formatTiyin(wouldBeWorthNow)} (
                    {wouldBeWorthNow > s.proceedsTiyin ? "продажа упустила" : "продажа сэкономила"}{" "}
                    {formatTiyin(Math.abs(wouldBeWorthNow - s.proceedsTiyin))})
                  </span>
                )}
              </p>
            );
          })}
        </div>
      )}

      <div className="played-card">
        <h4>Тайминг покупок</h4>
        {fifo.openLots.map((lot, i) => {
          const monthAvg = monthAveragePriceTiyin(prices, lot.date.slice(0, 7));
          const percent = monthAvg !== null ? computeTimingPercent(lot.unitCostTiyin, monthAvg) : null;
          return (
            <p key={i} className="hint">
              {lot.date.slice(0, 10)}: {formatTiyin(lot.unitCostTiyin)}/шт
              {percent !== null && (percent > 0 ? ` — переплатил ${percent.toFixed(1)}%` : ` — сэкономил ${Math.abs(percent).toFixed(1)}%`)}
            </p>
          );
        })}
      </div>

      <div className="played-card">
        <h4>А если бы на депозит</h4>
        <label className="hint">
          Ставка, % годовых{" "}
          <input
            type="number"
            value={depositRatePercent}
            onChange={(e) => setDepositRatePercent(Number(e.target.value))}
            style={{ width: 50 }}
          />
        </label>
        <p className="hint">
          {depositValueTiyin !== null ? (
            <>
              То же вложение ({formatTiyin(position.investedTiyin)}) на депозит под {depositRatePercent}% дало бы
              примерно {formatTiyin(depositValueTiyin)}.
            </>
          ) : (
            "Нет открытых позиций для сравнения."
          )}
        </p>
      </div>
    </div>
  );
}
