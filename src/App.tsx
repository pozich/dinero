import { useEffect, useState } from "react";
import { TabBar, TAB_ORDER, type TabId } from "./app/TabBar";
import { FilesScreen } from "./features/files/FilesScreen";
import { OperationsScreen } from "./features/operations/OperationsScreen";
import { DataScreen } from "./features/data/DataScreen";
import "./app/theme.css";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function App() {
  const [tab, setTab] = useState<TabId>("files");

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

  return (
    <div className="app">
      <TabBar active={tab} onChange={setTab} />
      {tab === "files" && <FilesScreen />}
      {tab === "operations" && <OperationsScreen />}
      {tab === "data" && <DataScreen />}
    </div>
  );
}

export default App;
