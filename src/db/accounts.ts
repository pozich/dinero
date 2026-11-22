import type { DbClient } from "./types";

export type Account = {
  id: number;
  name: string;
  kind: string;
  is_transit: number;
};

export function listAccounts(db: DbClient): Promise<Account[]> {
  return db.select<Account[]>("SELECT * FROM accounts ORDER BY id");
}

export async function getAccountIdByKind(db: DbClient, kind: string): Promise<number> {
  const rows = await db.select<{ id: number }[]>(
    "SELECT id FROM accounts WHERE kind = $1",
    [kind],
  );
  if (!rows[0]) throw new Error(`Unknown account kind "${kind}"`);
  return rows[0].id;
}
