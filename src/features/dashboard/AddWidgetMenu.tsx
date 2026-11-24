import { useState } from "react";
import { WIDGET_LABELS } from "./widgetRegistry";
import type { WidgetType } from "../../dashboard/presetConfig";
import { WIDGET_TYPES } from "../../dashboard/presetConfig";

export function AddWidgetMenu({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="add-widget-menu">
      <button type="button" onClick={() => setOpen((v) => !v)}>
        + Виджет
      </button>
      {open && (
        <ul className="add-widget-list">
          {WIDGET_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => {
                  onAdd(type);
                  setOpen(false);
                }}
              >
                {WIDGET_LABELS[type]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
