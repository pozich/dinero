import { describe, expect, it } from "vitest";
import { buildCategoryTree, flattenCategoryTree } from "../../src/features/categories/buildCategoryTree";
import type { Category } from "../../src/db/categories";

function cat(partial: Partial<Category>): Category {
  return { id: 1, name: "x", parent_id: null, is_system: 0, color: null, icon: null, ...partial };
}

describe("buildCategoryTree", () => {
  it("nests children under their parent", () => {
    const categories = [cat({ id: 1, name: "Еда" }), cat({ id: 2, name: "Кафе", parent_id: 1 })];
    const tree = buildCategoryTree(categories);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe("Кафе");
  });

  it("sorts siblings alphabetically at every level", () => {
    const categories = [cat({ id: 1, name: "Транспорт" }), cat({ id: 2, name: "Еда" })];
    const tree = buildCategoryTree(categories);
    expect(tree.map((n) => n.name)).toEqual(["Еда", "Транспорт"]);
  });

  it("treats a category whose parent no longer exists as a root", () => {
    const categories = [cat({ id: 2, name: "Кафе", parent_id: 999 })];
    expect(buildCategoryTree(categories)).toHaveLength(1);
  });
});

describe("flattenCategoryTree", () => {
  it("returns every node, parents and children together", () => {
    const categories = [cat({ id: 1, name: "Еда" }), cat({ id: 2, name: "Кафе", parent_id: 1 })];
    const flat = flattenCategoryTree(buildCategoryTree(categories));
    expect(flat.map((c) => c.name).sort()).toEqual(["Еда", "Кафе"]);
  });
});
