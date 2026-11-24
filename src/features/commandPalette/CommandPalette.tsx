import { useEffect, useState } from "react";
import { useAllCommands } from "./CommandContext";
import { searchPalette } from "./searchPalette";

/** Ctrl+K (SPEC-2.md Ф4) — searches whatever the active tab registered
 * (actions, and that screen's own operations/categories where it chose
 * to register them), plus app-wide navigation. Opens even while typing
 * in a field — Ctrl+K isn't a character any text input needs. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const commands = useAllCommands();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setHighlight(0);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const results = searchPalette(commands, query);

  function run(index: number) {
    const command = results[index];
    if (!command) return;
    command.run();
    setOpen(false);
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Что сделать?"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(highlight);
            }
          }}
        />
        <ul className="command-list">
          {results.map((c, i) => (
            <li key={c.id} className={i === highlight ? "active" : ""}>
              <button type="button" onClick={() => run(i)}>
                {c.label}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="hint">Ничего не найдено.</li>}
        </ul>
      </div>
    </div>
  );
}
