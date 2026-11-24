import type { Category } from "../../db/categories";

export type TreeNode = Category & { children: TreeNode[] };

/** Nests the flat `categories` table into a tree by `parent_id`, siblings
 * sorted alphabetically at every level — shared by the category manager
 * and the operations sidebar (SPEC-2.md 4.3/Ф4). */
export function buildCategoryTree(categories: Category[]): TreeNode[] {
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

export function flattenCategoryTree(nodes: TreeNode[]): Category[] {
  return nodes.flatMap((n) => [n as Category, ...flattenCategoryTree(n.children)]);
}
