import type { AccountOverview } from "../../db/accountOverview";
import { formatTiyin } from "../operations/money";

/** SPEC-2.md 6.1: баланс + сверка с выпиской + таймлайн покрытия по
 * месяцам, с дырами подсвеченными. */
export function AccountsOverview({ accounts }: { accounts: AccountOverview[] }) {
  return (
    <div className="accounts-overview">
      {accounts.map((a) => (
        <div key={a.accountId} className="account-overview-card">
          <div className="account-overview-head">
            <span>{a.accountName}</span>
            <span>{formatTiyin(a.currentBalanceTiyin)}</span>
          </div>
          {a.discrepancyTiyin !== null && a.discrepancyTiyin !== 0 && (
            <div className="account-overview-discrepancy">
              Расхождение с выпиской на {a.asOfStatementPeriodEnd?.slice(0, 10)}:{" "}
              {formatTiyin(a.discrepancyTiyin)}
            </div>
          )}
          {a.monthly.length > 0 && (
            <div className="coverage-strip">
              {a.monthly.map((m) => (
                <span
                  key={m.month}
                  className={`coverage-cell ${m.hasGap ? "coverage-gap" : ""}`}
                  title={m.month}
                />
              ))}
            </div>
          )}
          {a.gaps.length > 0 && (
            <ul className="coverage-gap-list">
              {a.gaps.map((g, i) => (
                <li key={i}>
                  нет данных {g.start.slice(0, 10)} – {g.end.slice(0, 10)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
