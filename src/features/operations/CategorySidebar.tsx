import { useEffect, useState } from "react";
import { getDb } from "../../db/client";
import { listCategories } from "../../db/categories";
import { listCategoryCounts, type CategoryCount } from "../../db/categoryTree";
import { buildCategoryTree, type TreeNode } from "../categories/buildCategoryTree";
import { formatTiyin } from "./money";

/** Collapsible tree with search and counts (SPEC-2.md Ф4) — drop a
 * dragged operation (or the current multi-selection) on a category here
 * to assign it. The drag payload is just the dragged row's id; the
 * operations table is responsible for carrying the whole selection along
 * when a *selected* row is what's being dragged. */
export function CategorySidebar({
  collapsed,
  onToggleCollapsed,
  onAssign,
  refreshToken,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAssign: (categoryName: string, draggedId: number) => void;
  refreshToken: number;
}) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [counts, setCounts] = useState<Map<number, CategoryCount>>(new Map());
  const [search, setSearch] = useState("");
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  useEffect(() => {
    getDb().then(async (db) => {
      setTree(buildCategoryTree(await listCategories(db)));
      setCounts(new Map((await listCategoryCounts(db)).map((c) => [c.category_id, c])));
    });
  }, [refreshToken]);

  if (collapsed) {
    return (
      <button type="button" className="sidebar-collapsed" onClick={onToggleCollapsed} title="Показать категории">
        ☰
      </button>
    );
  }

  const q = search.trim().toLowerCase();
  function matches(node: TreeNode): boolean {
    return node.name.toLowerCase().includes(q) || node.children.some(matches);
  }

  function renderNode(node: TreeNode, depth: number) {
    if (q && !matches(node)) return null;
    const count = counts.get(node.id);
    return (
      <div key={node.id}>
        <div
          className={`sidebar-category${dragOverId === node.id ? " drag-over" : ""}`}
          style={{ paddingLeft: depth * 14 }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(node.id);
          }}
          onDragLeave={() => setDragOverId((id) => (id === node.id ? null : id))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverId(null);
            const draggedId = Number(e.dataTransfer.getData("text/plain"));
            if (!Number.isNaN(draggedId)) onAssign(node.name, draggedId);
          }}
        >
          {node.name}
          {count && (
            <span className="hint">
              {" "}
              · {count.count} · {formatTiyin(count.total_tiyin)}
            </span>
          )}
        </div>
        {node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="category-sidebar">
      <div className="category-sidebar-head">
        <input
          placeholder="Поиск категорий..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" onClick={onToggleCollapsed} title="Свернуть">
          «
        </button>
      </div>
      <div className="category-sidebar-tree">{tree.map((n) => renderNode(n, 0))}</div>
      <p className="hint">Перетащите операцию на категорию, чтобы проставить её.</p>
    </div>
  );
}
