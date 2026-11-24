import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import {
  listPeople,
  listAllAliasesByPerson,
  findOrCreatePersonByAlias,
  createPerson,
  renamePerson,
  addAlias,
  mergePeople,
} from "../../src/db/people";
import { createDebt, listDebts } from "../../src/db/debts";

describe("people", () => {
  it("creates a new person+alias the first time an alias is seen", async () => {
    const db = createTestDb();
    const id = await findOrCreatePersonByAlias(db, "Роман П.");
    const people = await listPeople(db);
    expect(people).toEqual([{ id, name: "Роман П." }]);
  });

  it("resolves a known alias to the same person without creating a duplicate", async () => {
    const db = createTestDb();
    const first = await findOrCreatePersonByAlias(db, "Роман П.");
    const second = await findOrCreatePersonByAlias(db, "Роман П.");
    expect(second).toBe(first);
    expect(await listPeople(db)).toHaveLength(1);
  });

  it("renames a person", async () => {
    const db = createTestDb();
    const id = await createPerson(db, "Alias Name");
    await renamePerson(db, id, "Роман Петров");
    expect((await listPeople(db))[0].name).toBe("Роман Петров");
  });

  it("lets a second alias resolve to a person via addAlias", async () => {
    const db = createTestDb();
    const id = await createPerson(db, "Роман");
    await addAlias(db, id, "Роман Б.");
    expect(await findOrCreatePersonByAlias(db, "Роман Б.")).toBe(id);
  });

  it("moves an alias even if it belonged to a different person", async () => {
    const db = createTestDb();
    const a = await createPerson(db, "A");
    const b = await createPerson(db, "B");
    await addAlias(db, a, "X");
    await addAlias(db, b, "X");
    expect(await findOrCreatePersonByAlias(db, "X")).toBe(b);
  });

  it("merges two people: aliases and debts move, the source person is gone", async () => {
    const db = createTestDb();
    const target = await createPerson(db, "Роман П.");
    const source = await createPerson(db, "Роман Б.");
    await addAlias(db, source, "Роман Б.");
    await createDebt(db, {
      personId: source,
      direction: "lent",
      transactionId: null,
      amountTiyin: 100000,
      occurredAt: "2026-01-01T00:00:00.000Z",
      dueDate: null,
      note: null,
    });

    await mergePeople(db, target, source);

    const people = await listPeople(db);
    expect(people.map((p) => p.id)).toEqual([target]);

    const aliases = await listAllAliasesByPerson(db);
    expect(aliases.get(target)).toContain("Роман Б.");

    const debts = await listDebts(db);
    expect(debts[0].personId).toBe(target);
  });
});
