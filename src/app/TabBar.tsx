export type TabId = "files" | "operations" | "analytics";

const TABS: { id: TabId; label: string }[] = [
  { id: "files", label: "Файлы" },
  { id: "operations", label: "Категории + Операции" },
  { id: "analytics", label: "Аналитика" },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === active ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export const TAB_ORDER: TabId[] = TABS.map((t) => t.id);
