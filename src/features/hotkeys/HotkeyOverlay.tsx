import { useEffect, useState } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Везде",
    keys: [
      ["A / D", "переключить вкладку"],
      ["Ctrl+K", "палитра команд"],
      ["Ctrl+Z / Ctrl+Shift+Z", "отменить / повторить"],
      ["?", "эта подсказка"],
      ["Esc", "закрыть окно / снять выделение"],
    ],
  },
  {
    title: "Операции",
    keys: [
      ["↑ / ↓", "выбрать строку"],
      ["Enter / двойной клик", "редактировать категорию"],
      ["Ctrl+S", "разрез операции"],
      ["N", "новая ручная операция"],
      ["Ctrl+A", "выбрать все"],
      ["Shift+клик", "выделить диапазон"],
      ["Ctrl+клик", "добавить/убрать из выделения"],
      ["Рамка мышью", "выделить несколько"],
      ["Shift+клик по заголовку", "вторичная сортировка"],
      ["Правый клик / долгий тап", "контекстное меню"],
      ["Свайп влево/вправо (телефон)", "категория / не учитывать"],
    ],
  },
];

/** `?` (SPEC-2.md Ф4) — lists the hotkeys that actually exist right now,
 * not a wishlist. */
export function HotkeyOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal hotkey-overlay" onClick={(e) => e.stopPropagation()}>
        <h3>Горячие клавиши</h3>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h4>{group.title}</h4>
            <table>
              <tbody>
                {group.keys.map(([key, desc]) => (
                  <tr key={key}>
                    <td>
                      <code>{key}</code>
                    </td>
                    <td className="hint">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="modal-actions">
          <button type="button" onClick={() => setOpen(false)}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
