import { useEffect, useState } from "react";
import { getDb } from "../../db/client";
import { buildReviewCandidates, type ReviewCandidate } from "../../review/buildReviewCandidates";
import { confirmTransferLink, rejectTransferLink } from "../../db/transferLinks";
import { formatTransactionDate } from "../operations/dateFormat";
import { formatTiyin } from "../operations/money";
import { useUndoStack } from "../../undo/UndoContext";
import { useReadOnly } from "../../reliability/ReadOnlyContext";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

const KIND_LABEL: Record<ReviewCandidate["kind"], string> = {
  transfer: "Перевод между счетами",
  refund: "Возврат",
};

function Card({ t }: { t: ReviewCandidate["from"] }) {
  return (
    <div className="review-card">
      <div className="review-card-account">{t.account_name}</div>
      <div className="review-card-date">{formatTransactionDate(t.occurred_at, true)}</div>
      <div className="review-card-amount">{formatTiyin(t.amount_tiyin)}</div>
      <div className="review-card-description">{t.description}</div>
    </div>
  );
}

export function ReviewScreen({ onClose, onCountChange }: { onClose: () => void; onCountChange: (n: number) => void }) {
  useBackButtonClose(onClose);
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const undoStack = useUndoStack();
  const readOnly = useReadOnly();

  async function refresh() {
    const db = await getDb();
    const next = await buildReviewCandidates(db);
    setCandidates(next);
    onCountChange(next.length);
    setActiveIndex((i) => Math.min(i, Math.max(next.length - 1, 0)));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function confirm(candidate: ReviewCandidate) {
    if (readOnly) return;
    const db = await getDb();
    const id = await confirmTransferLink(db, candidate.from.id, candidate.to.id, candidate.kind);
    undoStack?.pushCreated(
      `${KIND_LABEL[candidate.kind]}: ${candidate.from.description}`,
      "transfer_links",
      id,
    );
    refresh();
  }

  async function reject(candidate: ReviewCandidate) {
    if (readOnly) return;
    const db = await getDb();
    const id = await rejectTransferLink(db, candidate.from.id, candidate.to.id, candidate.kind);
    undoStack?.pushCreated(`Отклонено: ${candidate.from.description}`, "transfer_links", id);
    refresh();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = candidates[activeIndex];
      if (!active) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, candidates.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirm(active);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        reject(active);
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [candidates, activeIndex]);

  return (
    <div className="modal-backdrop">
      <div className="modal review-screen">
        <h3>Проверить ({candidates.length})</h3>
        <p className="hint">
          Enter — подтвердить, Backspace — отклонить, ↑/↓ — следующий. Отклонённые
          пары больше не предлагаются.
        </p>

        {loading ? (
          <p className="hint">Загрузка…</p>
        ) : candidates.length === 0 ? (
          <p className="hint">Кандидатов не найдено.</p>
        ) : (
          <ul className="review-list">
            {candidates.map((c, i) => (
              <li key={`${c.from.id}-${c.to.id}`} className={i === activeIndex ? "active" : ""}>
                <div className="review-reason">
                  {KIND_LABEL[c.kind]} · {c.dateDiffDays === 0 ? "в тот же день" : `±${c.dateDiffDays} дн.`} ·{" "}
                  {Math.round(c.confidence * 100)}%
                </div>
                <div className="review-pair">
                  <Card t={c.from} />
                  <span className="review-arrow">→</span>
                  <Card t={c.to} />
                </div>
                <div className="review-actions">
                  <button type="button" onClick={() => confirm(c)} disabled={readOnly}>
                    ✓ Подтвердить
                  </button>
                  <button type="button" onClick={() => reject(c)} disabled={readOnly}>
                    ✕ Отклонить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
