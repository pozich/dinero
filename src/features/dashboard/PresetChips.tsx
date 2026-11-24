import { useEffect, useState } from "react";
import type { DashboardPreset } from "../../db/dashboardPresets";

/** SPEC-2.md 7: кнопки-чипы, переключение в один клик и хоткеями `1`–`9`
 * (hotkeys are wired by the parent, which owns the keydown listener),
 * переименовать/дублировать/удалить через контекстное меню, порядок —
 * перетаскиванием. */
export function PresetChips({
  presets,
  activeId,
  onSelect,
  onReorder,
  onRename,
  onDuplicate,
  onDelete,
  onSetDefault,
}: {
  presets: DashboardPreset[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  onRename: (preset: DashboardPreset) => void;
  onDuplicate: (id: number) => void;
  onDelete: (preset: DashboardPreset) => void;
  onSetDefault: (id: number) => void;
}) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ preset: DashboardPreset; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  function handleDrop(targetId: number) {
    if (draggedId === null || draggedId === targetId) return;
    const ids = presets.map((p) => p.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    onReorder(ids);
    setDraggedId(null);
  }

  return (
    <div className="preset-chips">
      {presets.map((preset, i) => (
        <button
          key={preset.id}
          type="button"
          className={`preset-chip ${preset.id === activeId ? "active" : ""}`}
          title={i < 9 ? `${preset.name} (${i + 1})` : preset.name}
          draggable
          onDragStart={() => setDraggedId(preset.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(preset.id)}
          onClick={() => onSelect(preset.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ preset, x: e.clientX, y: e.clientY });
          }}
        >
          {preset.icon && <span className="preset-chip-icon">{preset.icon}</span>}
          {preset.name}
          {preset.isDefault && <span className="preset-chip-default" title="Пресет по умолчанию">★</span>}
        </button>
      ))}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { onRename(contextMenu.preset); setContextMenu(null); }}>
            Переименовать
          </button>
          <button type="button" onClick={() => { onDuplicate(contextMenu.preset.id); setContextMenu(null); }}>
            Дублировать
          </button>
          <button type="button" onClick={() => { onSetDefault(contextMenu.preset.id); setContextMenu(null); }}>
            Сделать по умолчанию
          </button>
          <button type="button" onClick={() => { onDelete(contextMenu.preset); setContextMenu(null); }}>
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
