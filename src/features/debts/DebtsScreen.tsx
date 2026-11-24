import { useCallback, useEffect, useMemo, useState } from "react";
import { getDb } from "../../db/client";
import {
  listDebts,
  listRepayments,
  deleteDebt,
  recordRepayment,
  listTransactionsNotLinkedToAnyDebt,
} from "../../db/debts";
import { listPeople, listAllAliasesByPerson, type Person } from "../../db/people";
import { listCategories, type Category } from "../../db/categories";
import {
  computeDebtBalances,
  type DebtWithBalance,
  type PersonDebtSummary,
} from "../../debts/computeDebtBalances";
import { findRepaymentCandidates, type DebtForMatching } from "../../debts/findRepaymentCandidates";
import { formatTiyin } from "../operations/money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";
import { NewDebtDialog } from "./NewDebtDialog";
import { RecordRepaymentDialog } from "./RecordRepaymentDialog";
import { ForgiveDebtDialog } from "./ForgiveDebtDialog";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function DebtsScreen({ onClose, onCountChange }: { onClose: () => void; onCountChange?: (n: number) => void }) {
  const [tab, setTab] = useState<"lent" | "borrowed">("lent");
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summaries, setSummaries] = useState<PersonDebtSummary[]>([]);
  const [candidatesByDebt, setCandidatesByDebt] = useState<Map<number, { transactionId: number; description: string; amountTiyin: number; occurredAt: string }[]>>(new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [newDebtOpen, setNewDebtOpen] = useState(false);
  const [repayFor, setRepayFor] = useState<DebtWithBalance & { personName: string } | null>(null);
  const [forgiveFor, setForgiveFor] = useState<DebtWithBalance & { personName: string } | null>(null);
  useBackButtonClose(onClose);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [debts, repayments, peopleList, cats, aliasesByPerson, unlinked] = await Promise.all([
      listDebts(db),
      listRepayments(db),
      listPeople(db),
      listCategories(db),
      listAllAliasesByPerson(db),
      listTransactionsNotLinkedToAnyDebt(db),
    ]);
    const nextSummaries = computeDebtBalances(debts, repayments, peopleList);
    setSummaries(nextSummaries);
    setPeople(peopleList);
    setCategories(cats);

    const matchable: DebtForMatching[] = nextSummaries.flatMap((s) =>
      s.debts
        .filter((d) => d.status === "open")
        .map((d) => ({
          id: d.id,
          direction: d.direction,
          personAliases: aliasesByPerson.get(d.personId) ?? [],
          remainingTiyin: d.remainingTiyin,
          occurredAt: d.occurredAt,
        })),
    );
    const candidates = findRepaymentCandidates(
      matchable,
      unlinked.map((t) => ({ id: t.id, occurredAt: t.occurred_at, amountTiyin: t.amount_tiyin, description: t.description })),
    );
    const byDebt = new Map<number, { transactionId: number; description: string; amountTiyin: number; occurredAt: string }[]>();
    for (const c of candidates) {
      const tx = unlinked.find((t) => t.id === c.transactionId)!;
      const list = byDebt.get(c.debtId) ?? [];
      list.push({ transactionId: tx.id, description: tx.description, amountTiyin: tx.amount_tiyin, occurredAt: tx.occurred_at });
      byDebt.set(c.debtId, list);
    }
    setCandidatesByDebt(byDebt);

    onCountChange?.(nextSummaries.filter((s) => s.remainingTiyin > 0).length);
  }, [onCountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tabSummaries = useMemo(() => summaries.filter((s) => s.direction === tab), [summaries, tab]);
  const lentCount = summaries.filter((s) => s.direction === "lent" && s.remainingTiyin > 0).length;
  const borrowedCount = summaries.filter((s) => s.direction === "borrowed" && s.remainingTiyin > 0).length;

  async function confirmRepayment(debt: DebtWithBalance, candidate: { transactionId: number; amountTiyin: number; occurredAt: string }) {
    const db = await getDb();
    await recordRepayment(db, debt.id, candidate.transactionId, Math.abs(candidate.amountTiyin), candidate.occurredAt);
    refresh();
  }

  async function removeDebt(id: number) {
    if (!window.confirm("Удалить запись о долге целиком, вместе с возвратами?")) return;
    const db = await getDb();
    await deleteDebt(db, id);
    refresh();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal debts-screen" onClick={(e) => e.stopPropagation()}>
        <h3>Долги</h3>
        <div className="debts-tabs">
          <button type="button" className={tab === "lent" ? "active" : ""} onClick={() => setTab("lent")}>
            Мне должны ({lentCount})
          </button>
          <button type="button" className={tab === "borrowed" ? "active" : ""} onClick={() => setTab("borrowed")}>
            Я должен ({borrowedCount})
          </button>
          <button type="button" className="manual-add-button" onClick={() => setNewDebtOpen(true)}>
            + Долг
          </button>
        </div>

        {tabSummaries.length === 0 && <p className="hint">Пока ничего нет.</p>}

        <ul className="debt-person-list">
          {tabSummaries.map((summary) => (
            <li key={`${summary.personId}:${summary.direction}`} className="debt-person-card">
              <div className="debt-person-head">
                <span className="debt-person-name">{summary.personName}</span>
                <span className="debt-person-remaining">{formatTiyin(summary.remainingTiyin)}</span>
                {summary.overdue && <span className="debt-overdue-badge">просрочено</span>}
                <span className="hint">с {formatDate(summary.since)}</span>
              </div>

              <ul className="debt-history">
                {summary.debts.map((debt) => (
                  <li key={debt.id} className="debt-history-item">
                    <div className="debt-history-row">
                      <span>{formatDate(debt.occurredAt)}</span>
                      <span>{formatTiyin(debt.direction === "lent" ? -debt.amountTiyin : debt.amountTiyin)}</span>
                      <span className="hint">остаток {formatTiyin(debt.remainingTiyin)}</span>
                      <span className={`debt-status debt-status-${debt.status}`}>
                        {debt.status === "open" ? "открыт" : debt.status === "closed" ? "закрыт" : "списан"}
                      </span>
                      {debt.note && <span className="hint">{debt.note}</span>}
                      <span className="debt-history-actions">
                        {debt.status === "open" && (
                          <button
                            type="button"
                            onClick={() => setRepayFor({ ...debt, personName: summary.personName })}
                          >
                            Возврат
                          </button>
                        )}
                        {debt.status === "open" && debt.direction === "lent" && (
                          <button
                            type="button"
                            onClick={() => setForgiveFor({ ...debt, personName: summary.personName })}
                          >
                            Списать
                          </button>
                        )}
                        <button type="button" onClick={() => removeDebt(debt.id)}>
                          Удалить
                        </button>
                      </span>
                    </div>
                    {debt.repayments.length > 0 && (
                      <ul className="debt-repayment-list">
                        {debt.repayments.map((r) => (
                          <li key={r.id} className="hint">
                            возврат {formatTiyin(r.amountTiyin)} · {formatDate(r.occurredAt)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(candidatesByDebt.get(debt.id) ?? [])
                      .filter((c) => !dismissed.has(`${debt.id}:${c.transactionId}`))
                      .map((candidate) => (
                        <div key={candidate.transactionId} className="debt-suggestion">
                          Похоже на возврат: {candidate.description} · {formatTiyin(candidate.amountTiyin)} ·{" "}
                          {formatDate(candidate.occurredAt)}
                          <button type="button" onClick={() => confirmRepayment(debt, candidate)}>
                            Подтвердить
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDismissed((d) => new Set(d).add(`${debt.id}:${candidate.transactionId}`))
                            }
                          >
                            Отклонить
                          </button>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>

        {newDebtOpen && (
          <NewDebtDialog
            people={people}
            onClose={() => setNewDebtOpen(false)}
            onCreated={() => {
              setNewDebtOpen(false);
              refresh();
            }}
          />
        )}

        {repayFor && (
          <RecordRepaymentDialog
            debtId={repayFor.id}
            personName={repayFor.personName}
            remainingTiyin={repayFor.remainingTiyin}
            onClose={() => setRepayFor(null)}
            onRecorded={() => {
              setRepayFor(null);
              refresh();
            }}
          />
        )}

        {forgiveFor && (
          <ForgiveDebtDialog
            debtId={forgiveFor.id}
            personName={forgiveFor.personName}
            remainingTiyin={forgiveFor.remainingTiyin}
            categories={categories}
            onClose={() => setForgiveFor(null)}
            onForgiven={() => {
              setForgiveFor(null);
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
