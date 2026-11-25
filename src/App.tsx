import { useEffect, useMemo, useState } from "react";
import { TabBar, TAB_ORDER, type TabId } from "./app/TabBar";
import { FilesHubScreen } from "./features/files/FilesHubScreen";
import { OperationsHubScreen } from "./features/operations/OperationsHubScreen";
import { AnalyticsHubScreen } from "./features/analytics/AnalyticsHubScreen";
import { ReadOnlyProvider } from "./reliability/ReadOnlyContext";
import { LockConflictDialog } from "./reliability/LockConflictDialog";
import { SyncConflictBanner, ReadOnlyBanner } from "./reliability/Banners";
import { installGlobalErrorLogging } from "./reliability/errorLog";
import { backupBefore } from "./reliability/backups";
import { installTestHooks } from "./testHooks";
import { UndoProvider, useUndoState } from "./undo/UndoContext";
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

const TAB_LABELS: Record<TabId, string> = {
  files: "Файлы",
  operations: "Категории + Операции",
  analytics: "Аналитика",
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
        <UndoControls />
      </div>
      {tab === "files" && <FilesHubScreen />}
      {tab === "operations" && <OperationsHubScreen />}
      {tab === "analytics" && <AnalyticsHubScreen />}
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
