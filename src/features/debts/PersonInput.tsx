import { useState } from "react";
import type { Person } from "../../db/people";

/** Free-text name entry with autocomplete against known people — same
 * "type freely, or pick an existing one" idea as `CategoryInput`, just
 * without the tree/create-on-commit parts a category needs. */
export function PersonInput({
  value,
  people,
  onChange,
}: {
  value: string;
  people: readonly Person[];
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const matches = value.trim()
    ? people.filter((p) => p.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="category-input">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Имя человека..."
      />
      {focused && matches.length > 0 && (
        <ul className="category-dropdown">
          {matches.map((p) => (
            <li key={p.id} onMouseDown={() => onChange(p.name)}>
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
