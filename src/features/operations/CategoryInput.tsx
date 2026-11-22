import { useEffect, useRef, useState } from "react";
import type { Category } from "../../db/categories";

export function CategoryInput({
  initialValue,
  categories,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  categories: Category[];
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialValue);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const matches = categories
    .filter((c) => c.name.toLowerCase().includes(text.trim().toLowerCase()))
    .slice(0, 8);
  const exact = categories.find((c) => c.name.toLowerCase() === text.trim().toLowerCase());
  const willCreate = text.trim().length > 0 && !exact;

  function commit(name: string) {
    if (!name.trim()) {
      onCancel();
      return;
    }
    onCommit(name.trim());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    const maxHighlight = matches.length - 1 + (willCreate ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(maxHighlight, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = highlight < matches.length ? matches[highlight] : undefined;
      commit(picked ? picked.name : text);
    }
  }

  return (
    <div className="category-input">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={onCancel}
        placeholder="Категория..."
      />
      {text.trim() && (
        <ul className="category-dropdown">
          {matches.map((c, i) => (
            <li key={c.id} className={i === highlight ? "active" : ""}>
              {c.name}
            </li>
          ))}
          {willCreate && (
            <li className={matches.length === highlight ? "active" : ""}>
              Создать «{text.trim()}»
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
