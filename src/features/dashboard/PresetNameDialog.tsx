import { useState } from "react";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

/** "Сохранить как пресет" → имя + иконка (SPEC-2.md 7); also reused for
 * rename. Icon is just a short string (an emoji, typically) — no picker,
 * the user types or pastes one. */
export function PresetNameDialog({
  title,
  initialName,
  initialIcon,
  onSave,
  onClose,
}: {
  title: string;
  initialName: string;
  initialIcon: string | null;
  onSave: (name: string, icon: string | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon ?? "");
  useBackButtonClose(onClose);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="manual-form">
          <label>
            Название
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>
            Иконка (эмодзи, необязательно)
            <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim(), icon.trim() || null)}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
