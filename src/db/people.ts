import type { DbClient } from "./types";

export type Person = { id: number; name: string };

export function listPeople(db: DbClient): Promise<Person[]> {
  return db.select<Person[]>("SELECT * FROM people ORDER BY name");
}

export async function listAllAliasesByPerson(db: DbClient): Promise<Map<number, string[]>> {
  const rows = await db.select<{ person_id: number; alias: string }[]>(
    "SELECT person_id, alias FROM person_aliases",
  );
  const map = new Map<number, string[]>();
  for (const r of rows) {
    const list = map.get(r.person_id) ?? [];
    list.push(r.alias);
    map.set(r.person_id, list);
  }
  return map;
}

/** SPEC-2.md 8: "имена подтягиваются из описаний выписок" — a known alias
 * resolves to its person, an unseen one creates a brand-new person+alias
 * on the spot (named after the alias itself, until the user renames it). */
export async function findOrCreatePersonByAlias(db: DbClient, alias: string): Promise<number> {
  const existing = await db.select<{ person_id: number }[]>(
    "SELECT person_id FROM person_aliases WHERE alias = $1",
    [alias],
  );
  if (existing[0]) return existing[0].person_id;

  const personResult = await db.execute("INSERT INTO people (name) VALUES ($1)", [alias]);
  const personId = personResult.lastInsertId!;
  await db.execute("INSERT INTO person_aliases (person_id, alias) VALUES ($1, $2)", [personId, alias]);
  return personId;
}

export async function createPerson(db: DbClient, name: string): Promise<number> {
  const result = await db.execute("INSERT INTO people (name) VALUES ($1)", [name]);
  return result.lastInsertId!;
}

export async function renamePerson(db: DbClient, id: number, name: string): Promise<void> {
  await db.execute("UPDATE people SET name = $1 WHERE id = $2", [name, id]);
}

/** Moves an alias onto `personId` even if it already belonged to someone
 * else — adding an alias to a person is itself the "этот вариант написания
 * — тот же человек" merge action (SPEC-2.md 8). */
export async function addAlias(db: DbClient, personId: number, alias: string): Promise<void> {
  await db.execute(
    `INSERT INTO person_aliases (person_id, alias) VALUES ($1, $2)
     ON CONFLICT (alias) DO UPDATE SET person_id = excluded.person_id`,
    [personId, alias],
  );
}

/** "Объединить варианты написания одного человека" — every alias and debt
 * moves from `sourceId` onto `targetId`, then the now-empty source person
 * is deleted. */
export async function mergePeople(db: DbClient, targetId: number, sourceId: number): Promise<void> {
  await db.execute("UPDATE person_aliases SET person_id = $1 WHERE person_id = $2", [targetId, sourceId]);
  await db.execute("UPDATE debts SET person_id = $1 WHERE person_id = $2", [targetId, sourceId]);
  await db.execute("DELETE FROM people WHERE id = $1", [sourceId]);
}
