import { Fragment } from "react";
import type { CategoryTreeBucket } from "../../analytics/grouping";
import { formatTiyin } from "../operations/money";

/** SPEC-2.md 6.4's "таблица (с итогами и подытогами по дереву)" — each
 * parent row already carries its descendants' total (groupByCategoryTree),
 * indentation shows the nesting. */
function Rows({
  buckets,
  depth,
  onDrillDown,
}: {
  buckets: readonly CategoryTreeBucket[];
  depth: number;
  onDrillDown: (title: string, transactionIds: number[]) => void;
}) {
  return (
    <>
      {buckets
        .filter((b) => b.amountTiyin !== 0)
        .sort((a, b) => Math.abs(b.amountTiyin) - Math.abs(a.amountTiyin))
        .map((b) => (
          <Fragment key={`${b.categoryId ?? "none"}-${depth}`}>
            <tr>
              <td style={{ paddingLeft: 10 + depth * 18 }}>
                <button type="button" className="tree-table-name" onClick={() => onDrillDown(b.name, b.transactionIds)}>
                  {b.name}
                </button>
              </td>
              <td>{formatTiyin(b.amountTiyin)}</td>
            </tr>
            {b.children.length > 0 && <Rows buckets={b.children} depth={depth + 1} onDrillDown={onDrillDown} />}
          </Fragment>
        ))}
    </>
  );
}

export function CategoryTreeTable({
  buckets,
  onDrillDown,
}: {
  buckets: readonly CategoryTreeBucket[];
  onDrillDown: (title: string, transactionIds: number[]) => void;
}) {
  return (
    <table className="tree-table">
      <thead>
        <tr>
          <th>Категория</th>
          <th>Сумма</th>
        </tr>
      </thead>
      <tbody>
        <Rows buckets={buckets} depth={0} onDrillDown={onDrillDown} />
      </tbody>
    </table>
  );
}
