import { useEffect, useState } from "react";
import { getDb } from "../../db/client";
import { listCategories, type Category } from "../../db/categories";
import {
  renameCategory,
  moveCategory,
  mergeCategories,
  deleteCategory,
  listCategoryCounts,
  type CategoryCount,
} from "../../db/categoryTree";
import { formatTiyin } from "../operations/money";
import { useUndoStack } from "../../undo/UndoContext";
import { withUndo } from "../../undo/undoStack";
import { backupBefore } from "../../reliability/backups";
import { useReadOnly } from "../../reliability/ReadOnlyContext";

type TreeNode = Category & { children: TreeNode[] };

function buildTree(categories: Category[]): TreeNode[] {
  const byId = new Map<number, TreeNode>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id !== null ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function flatten(nodes: TreeNode[]): Category[] {
  return nodes.flatMap((n) => [n as Category, ...flatten(n.children)]);
}

type Action = { category: Category; kind: "merge" | "delete" };

export function CategoriesScreen({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Map<number, CategoryCount>>(new Map());
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [actionTarget, setActionTarget] = useState<number | "" | "none">("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const undoStack = useUndoStack();
  const readOnly = useReadOnly();

  async function refresh() {
    const db = await getDb();
    setCategories(await listCategories(db));
    setCounts(new Map((await listCategoryCounts(db)).map((c) => [c.category_id, c])));
  }

  useEffect(() => {
    refresh();
  }, []);

  const tree = buildTree(categories);
  const CATEGORY_TABLE_SPEC = [{ table: "categories", whereSql: "1=1", params: [] }];

  async function commitRename(id: number) {
    const name = renameText.trim();
    setRenamingId(null);
    if (!name || readOnly) return;
    const db = await getDb();
    await withUndo(undoStack, "Переименование категории", CATEGORY_TABLE_SPEC, () =>
      renameCategory(db, id, name),
    );
    refresh();
  }

  async function handleDrop(targetId: number | null) {
    if (draggedId === null || readOnly) return;
    const id = draggedId;
    setDraggedId(null);
    if (id === targetId) return;
    const db = await getDb();
    try {
      await withUndo(undoStack, "Перенос категории", CATEGORY_TABLE_SPEC, () =>
        moveCategory(db, id, targetId),
      );
      refresh();
    } catch (e) {
      window.alert(String(e));
    }
  }

  // Merge/delete can touch every split and rule pointing at the category —
  // possibly thousands of rows — so unlike rename/move above, these go
  // through a backup rather than the generic undo stack (same reasoning as
  // statement deletion: restore from backup, not Ctrl+Z, for bulk reassigns).
  async function confirmAction() {
    if (!action || actionTarget === "") return;
    if (readOnly) return;
    const db = await getDb();
    await backupBefore("bulk_action");
    try {
      if (action.kind === "merge") {
        await mergeCategories(db, action.category.id, actionTarget as number);
      } else {
        await deleteCategory(db, action.category.id, actionTarget === "none" ? null : (actionTarget as number));
      }
      setAction(null);
      setActionTarget("");
      refresh();
    } catch (e) {
      window.alert(String(e));
    }
  }

  function renderNode(node: TreeNode, depth: number) {
    const count = counts.get(node.id);
    return (
      <div key={node.id}>
        <div
          className="category-row"
          style={{ paddingLeft: depth * 18 }}
          draggable={!readOnly}
          onDragStart={() => setDraggedId(node.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(node.id)}
        >
          {renamingId === node.id ? (
            <input
              autoFocus
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onBlur={() => commitRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(node.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
          ) : (
            <span
              className="category-row-name"
              onDoubleClick={() => {
                if (readOnly) return;
                setRenamingId(node.id);
                setRenameText(node.name);
              }}
            >
              {node.name}
              {!!node.is_system && <span className="hint"> · системная</span>}
              {count && (
                <span className="hint">
                  {" "}
                  · {count.count} оп. · {formatTiyin(count.total_tiyin)}
                </span>
              )}
            </span>
          )}
          {!node.is_system && !readOnly && (
            <span className="category-row-actions">
              <button type="button" title="Слить с другой" onClick={() => setAction({ category: node, kind: "merge" })}>
                ⇄
              </button>
              <button type="button" title="Удалить" onClick={() => setAction({ category: node, kind: "delete" })}>
                ×
              </button>
            </span>
          )}
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  const allFlat = flatten(tree);

  return (
    <div className="modal-backdrop">
      <div className="modal categories-screen">
        <h3>Категории</h3>
        <p className="hint">
          Двойной клик — переименовать. Перетащите категорию на другую, чтобы сделать её
          дочерней; перетащите в «В корень», чтобы убрать родителя.
        </p>

        <div
          className="category-root-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(null)}
        >
          ⌂ В корень
        </div>

        <div className="category-tree">{tree.map((node) => renderNode(node, 0))}</div>

        {action && (
          <div className="category-action-form">
            <p className="hint">
              {action.kind === "merge"
                ? `Слить «${action.category.name}» с…`
                : `Удалить «${action.category.name}» — операции переназначить на…`}
            </p>
            <select
              value={actionTarget}
              onChange={(e) => setActionTarget(e.target.value === "none" ? "none" : Number(e.target.value))}
            >
              <option value="">Выберите...</option>
              {action.kind === "delete" && <option value="none">без категории</option>}
              {allFlat
                .filter((c) => c.id !== action.category.id)
                .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setAction(null)}>
              Отмена
            </button>
            <button type="button" disabled={actionTarget === ""} onClick={confirmAction}>
              {action.kind === "merge" ? "Слить" : "Удалить"}
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
