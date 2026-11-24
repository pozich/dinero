import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Category } from "../../db/categories";
import type { SortColumn, SortSpec, TransactionListItem } from "../../db/transactionsQuery";
import { formatTransactionDate } from "./dateFormat";
import { formatTiyin } from "./money";
import { CategoryInput } from "./CategoryInput";
import { toggleSort, addSecondarySort } from "./sorting";
import { selectSingle, toggleSelection, selectRange } from "./selection";
import { normalizeRect, rectsIntersect, type Rect } from "./marquee";
import { resizeColumn, type ColumnConfig } from "./tableColumns";
import { detectSwipe } from "./swipeGesture";

const COLUMN_LABELS: Record<SortColumn, string> = {
  occurred_at: "Дата",
  amount_tiyin: "Сумма",
  description: "Описание",
  category_name: "Категория",
};

const ROW_HEIGHT = 34;

export function OperationsTable({
  rows,
  categories,
  columns,
  onColumnsChange,
  onReorderColumn,
  sort,
  onSortChange,
  activeIndex,
  onActiveIndexChange,
  selectedIds,
  onSelectedIdsChange,
  editingId,
  onStartEdit,
  onCommitCategory,
  onCancelEdit,
  onContextMenu,
  onSwipeLeft,
  onSwipeRight,
  showYear,
  readOnly,
}: {
  rows: TransactionListItem[];
  categories: Category[];
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onReorderColumn: (fromIndex: number, toIndex: number) => void;
  sort: SortSpec[];
  onSortChange: (sort: SortSpec[]) => void;
  activeIndex: number | null;
  onActiveIndexChange: (index: number) => void;
  selectedIds: Set<number>;
  onSelectedIdsChange: (ids: Set<number>) => void;
  editingId: number | null;
  onStartEdit: (row: TransactionListItem) => void;
  onCommitCategory: (name: string) => void;
  onCancelEdit: () => void;
  onContextMenu: (e: ReactMouseEvent, row: TransactionListItem) => void;
  onSwipeLeft: (row: TransactionListItem) => void;
  onSwipeRight: (row: TransactionListItem) => void;
  showYear: boolean;
  readOnly: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const lastClickedRef = useRef<number | null>(null);
  const resizingRef = useRef<{ key: SortColumn; startX: number; startWidth: number } | null>(null);
  const draggedColumnRef = useRef<number | null>(null);
  const touchRef = useRef<{ x: number; y: number; row: TransactionListItem } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const [marqueeViewport, setMarqueeViewport] = useState<Rect | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeCurrentRef = useRef<Rect | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const visibleColumns = columns.filter((c) => c.visible);

  function selectRow(row: TransactionListItem, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
    if (e.shiftKey && lastClickedRef.current !== null) {
      onSelectedIdsChange(selectRange(rows, lastClickedRef.current, row.id));
    } else if (e.ctrlKey || e.metaKey) {
      onSelectedIdsChange(toggleSelection(selectedIds, row.id));
      lastClickedRef.current = row.id;
    } else {
      onSelectedIdsChange(selectSingle(row.id));
      lastClickedRef.current = row.id;
    }
  }

  // Marquee: mousedown on the scroll container itself (not on a row) starts
  // tracking in viewport coordinates, so intersection can be checked
  // directly against each rendered row's getBoundingClientRect() — no
  // manual scroll-offset math needed.
  function handleContainerMouseDown(e: ReactMouseEvent) {
    if (e.target !== scrollRef.current) return;
    marqueeStartRef.current = { x: e.clientX, y: e.clientY };
    const rect = normalizeRect(e.clientX, e.clientY, e.clientX, e.clientY);
    marqueeCurrentRef.current = rect;
    setMarqueeViewport(rect);
  }

  // The window listeners are attached once per drag (not re-subscribed on
  // every mousemove), so onUp reads the live rect from a ref rather than
  // from `marqueeViewport` state, which would otherwise be stale — it was
  // only ever the value captured when the drag *started*.
  useEffect(() => {
    function onMove(e: globalThis.MouseEvent) {
      const start = marqueeStartRef.current;
      if (!start) return;
      const rect = normalizeRect(start.x, start.y, e.clientX, e.clientY);
      marqueeCurrentRef.current = rect;
      setMarqueeViewport(rect);
    }

    function onUp() {
      const rect = marqueeCurrentRef.current;
      marqueeStartRef.current = null;
      marqueeCurrentRef.current = null;
      setMarqueeViewport(null);
      if (!rect) return;
      const hit = new Set<number>();
      for (const [id, el] of rowRefs.current) {
        const r = el.getBoundingClientRect();
        if (rectsIntersect(rect, { left: r.left, top: r.top, right: r.right, bottom: r.bottom })) {
          hit.add(id);
        }
      }
      if (hit.size > 0) onSelectedIdsChange(hit);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onSelectedIdsChange]);

  function startResize(e: ReactMouseEvent, column: ColumnConfig) {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key: column.key, startX: e.clientX, startWidth: column.width };

    function onMove(ev: globalThis.MouseEvent) {
      const r = resizingRef.current;
      if (!r) return;
      onColumnsChange(resizeColumn(columns, r.key, r.startWidth + (ev.clientX - r.startX)));
    }
    function onUp() {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Long-press = right-click on Android (SPEC-2.md Ф4): a timer armed on
  // touchstart, cancelled by any real movement (a swipe) or an early lift.
  function handleTouchStart(e: ReactTouchEvent, row: TransactionListItem) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, row };
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onContextMenu(
        { preventDefault: () => {}, clientX: t.clientX, clientY: t.clientY } as unknown as ReactMouseEvent,
        row,
      );
    }, 500);
  }

  function handleTouchMove(e: ReactTouchEvent) {
    const start = touchRef.current;
    if (!start || !longPressTimerRef.current) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleTouchEnd(e: ReactTouchEvent) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || longPressFiredRef.current) return;
    const t = e.changedTouches[0];
    const direction = detectSwipe(start.x, start.y, t.clientX, t.clientY);
    if (direction === "left") onSwipeLeft(start.row);
    else if (direction === "right") onSwipeRight(start.row);
  }

  return (
    <div className="vtable">
      <div className="vtable-header">
        {visibleColumns.map((col) => {
          const priority = sort.findIndex((s) => s.column === col.key);
          const spec = priority === -1 ? null : sort[priority];
          const columnIndex = columns.findIndex((c) => c.key === col.key);
          return (
            <div
              key={col.key}
              className="vtable-header-cell"
              style={{ width: col.width }}
              draggable
              onDragStart={() => {
                draggedColumnRef.current = columnIndex;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedColumnRef.current !== null) {
                  onReorderColumn(draggedColumnRef.current, columnIndex);
                }
                draggedColumnRef.current = null;
              }}
              onClick={(e) => onSortChange(e.shiftKey ? addSecondarySort(sort, col.key) : toggleSort(sort, col.key))}
            >
              {COLUMN_LABELS[col.key]}
              {spec && (
                <span className="sort-badge">
                  {priority + 1}
                  {spec.direction === "asc" ? "↑" : "↓"}
                </span>
              )}
              <span className="vtable-resizer" onMouseDown={(e) => startResize(e, col)} />
            </div>
          );
        })}
      </div>

      <div className="vtable-body" ref={scrollRef} onMouseDown={handleContainerMouseDown}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const isEditing = editingId === row.id;
            return (
              <div
                key={row.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.id, el);
                  else rowRefs.current.delete(row.id);
                }}
                className={[
                  "vtable-row",
                  virtualRow.index === activeIndex ? "active-row" : "",
                  selectedIds.has(row.id) ? "selected-row" : "",
                  row.is_ignored ? "ignored-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ position: "absolute", top: virtualRow.start, height: virtualRow.size, width: "100%" }}
                onMouseDown={(e) => {
                  selectRow(row, e);
                  onActiveIndexChange(virtualRow.index);
                }}
                onContextMenu={(e) => onContextMenu(e, row)}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(row.id))}
                onTouchStart={(e) => handleTouchStart(e, row)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {visibleColumns.map((col) => (
                  <div key={col.key} className="vtable-cell" style={{ width: col.width }}>
                    {col.key === "occurred_at" && formatTransactionDate(row.occurred_at, showYear)}
                    {col.key === "amount_tiyin" && formatTiyin(row.amount_tiyin)}
                    {col.key === "description" && (
                      <>
                        {!!row.is_manual && (
                          <span className="manual-icon" title="Ручная операция">
                            ●
                          </span>
                        )}
                        {row.description}
                      </>
                    )}
                    {col.key === "category_name" &&
                      (isEditing ? (
                        <CategoryInput
                          initialValue={row.category_name ?? ""}
                          categories={categories}
                          onCommit={onCommitCategory}
                          onCancel={onCancelEdit}
                        />
                      ) : (
                        <span
                          className="category-cell"
                          onDoubleClick={() => {
                            if (readOnly) return;
                            onStartEdit(row);
                          }}
                        >
                          {row.split_count > 1 ? `Разрез (${row.split_count})` : row.category_name ?? "—"}
                        </span>
                      ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {marqueeViewport && (
        <div
          className="marquee-box"
          style={{
            left: marqueeViewport.left,
            top: marqueeViewport.top,
            width: marqueeViewport.right - marqueeViewport.left,
            height: marqueeViewport.bottom - marqueeViewport.top,
          }}
        />
      )}
    </div>
  );
}
