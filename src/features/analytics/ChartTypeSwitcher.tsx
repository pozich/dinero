export type ChartType = "bar" | "line" | "donut" | "bubble" | "treemap" | "sankey" | "calendar" | "table";

const CHART_TYPES: { id: ChartType; icon: string; title: string }[] = [
  { id: "bar", icon: "▥", title: "Столбцы по периодам" },
  { id: "line", icon: "📈", title: "Денежный поток и остаток" },
  { id: "donut", icon: "◔", title: "Пончик по категориям" },
  { id: "bubble", icon: "○", title: "Круги по категориям" },
  { id: "treemap", icon: "▦", title: "Treemap категорий" },
  { id: "sankey", icon: "⇥", title: "Доходы → расходы" },
  { id: "calendar", icon: "▤", title: "Календарь трат" },
  { id: "table", icon: "☰", title: "Таблица с подытогами" },
];

/** SPEC-2.md 6.4 — "переключаются иконкой", minimum text. */
export function ChartTypeSwitcher({ value, onChange }: { value: ChartType; onChange: (type: ChartType) => void }) {
  return (
    <div className="chart-type-switcher">
      {CHART_TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.title}
          className={t.id === value ? "active" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
