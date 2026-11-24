import { useEffect, useMemo, useState } from "react";
import { TabBar, TAB_ORDER, type TabId } from "./app/TabBar";
import { FilesScreen } from "./features/files/FilesScreen";
import { OperationsScreen } from "./features/operations/OperationsScreen";
import { DataScreen } from "./features/data/DataScreen";
import { AnalyticsScreenLazy } from "./features/analytics/AnalyticsScreenLazy";
import { InvestmentsScreenLazy } from "./features/investments/InvestmentsScreenLazy";
import { ReadOnlyProvider } from "./reliability/ReadOnlyContext";
import { LockConflictDialog } from "./reliability/LockConflictDialog";
import { SyncConflictBanner, ReadOnlyBanner } from "./reliability/Banners";
import { installGlobalErrorLogging } from "./reliability/errorLog";
import { backupBefore } from "./reliability/backups";
import { installTestHooks } from "./testHooks";
import { UndoProvider, useUndoState } from "./undo/UndoContext";
import { ReviewScreen } from "./features/review/ReviewScreen";
import { buildReviewCandidates } from "./review/buildReviewCandidates";
import { DebtsScreen } from "./features/debts/DebtsScreen";
import { listDebts, listRepayments } from "./db/debts";
import { listPeople } from "./db/people";
import { computeDebtBalances } from "./debts/computeDebtBalances";
import { getDb } from "./db/client";
import { CommandProvider, useRegisterCommands } from "./features/commandPalette/CommandContext";
import { CommandPalette } from "./features/commandPalette/CommandPalette";
import { HotkeyOverlay } from "./features/hotkeys/HotkeyOverlay";
import "./app/theme.css";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function UndoControls() {
  const { stack, canUndo, canRedo } = useUndoState();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    async function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const isUndoChord = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z";
      if (!isUndoChord || !stack) return;
      e.preventDefault();
      const label = e.shiftKey ? await stack.redo() : await stack.undo();
      if (label) setToast(`${e.shiftKey ? "Повтор" : "Отмена"}: ${label}`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stack]);

  return (
    <div className="undo-controls">
      <button
        type="button"
        title="Отменить (Ctrl+Z)"
        disabled={!canUndo}
        onClick={async () => {
          const label = await stack?.undo();
          if (label) setToast(`Отмена: ${label}`);
        }}
      >
        ↶
      </button>
      <button
        type="button"
        title="Повторить (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={async () => {
          const label = await stack?.redo();
          if (label) setToast(`Повтор: ${label}`);
        }}
      >
        ↷
      </button>
      {toast && <span className="undo-toast">{toast}</span>}
    </div>
  );
}

function ReviewButton() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getDb()
      .then(buildReviewCandidates)
      .then((c) => setCount(c.length))
      .catch(() => {});
  }, []);

  return (
    <>
      <button type="button" className="review-button" onClick={() => setOpen(true)}>
        Проверить ({count})
      </button>
      {open && <ReviewScreen onClose={() => setOpen(false)} onCountChange={setCount} />}
    </>
  );
}

function DebtsButton() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getDb()
      .then(async (db) => {
        const [debts, repayments, people] = await Promise.all([listDebts(db), listRepayments(db), listPeople(db)]);
        return computeDebtBalances(debts, repayments, people).filter((s) => s.remainingTiyin > 0).length;
      })
      .then(setCount)
      .catch(() => {});
  }, []);

  return (
    <>
      <button type="button" className="review-button" onClick={() => setOpen(true)}>
        Долги ({count})
      </button>
      {open && <DebtsScreen onClose={() => setOpen(false)} onCountChange={setCount} />}
    </>
  );
}

const TAB_LABELS: Record<TabId, string> = {
  files: "Файлы",
  operations: "Категории + Операции",
  data: "Данные",
  analytics: "Аналитика",
  investments: "Инвестиции",
};

function AppShell() {
  const [tab, setTab] = useState<TabId>("files");

  const navCommands = useMemo(
    () =>
      TAB_ORDER.filter((t) => t !== tab).map((t) => ({
        id: `nav:${t}`,
        label: `Перейти: ${TAB_LABELS[t]}`,
        run: () => setTab(t),
      })),
    [tab],
  );
  useRegisterCommands("nav", navCommands);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key !== "a" && key !== "d") return;

      const index = TAB_ORDER.indexOf(tab);
      const nextIndex =
        key === "d"
          ? (index + 1) % TAB_ORDER.length
          : (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      setTab(TAB_ORDER[nextIndex]);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab]);

  useEffect(() => {
    installGlobalErrorLogging();
    installTestHooks();
    backupBefore("startup");
  }, []);

  return (
    <div className="app">
      <LockConflictDialog />
      <SyncConflictBanner />
      <ReadOnlyBanner />
      <div className="app-header">
        <TabBar active={tab} onChange={setTab} />
        <ReviewButton />
        <DebtsButton />
        <UndoControls />
      </div>
      {tab === "files" && <FilesScreen />}
      {tab === "operations" && <OperationsScreen />}
      {tab === "data" && <DataScreen />}
      {tab === "analytics" && <AnalyticsScreenLazy />}
      {tab === "investments" && <InvestmentsScreenLazy />}
      <CommandPalette />
      <HotkeyOverlay />
    </div>
  );
}

function App() {
  return (
    <ReadOnlyProvider>
      <UndoProvider>
        <CommandProvider>
          <AppShell />
        </CommandProvider>
      </UndoProvider>
    </ReadOnlyProvider>
  );
}

export default App;
