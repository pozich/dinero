# 07. SQL и SQLite — таблицы, внешние ключи, миграции

Dinero хранит все данные в одном файле SQLite (`dinero.db`) — это не
сервер базы данных, а просто файл на диске, который умеет читать и
писать библиотека SQLite прямо из приложения. Полностью офлайн: нет
ни сервера, ни сети для самой базы.

## Таблица — это просто... таблица

```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL
);
```

- `id INTEGER PRIMARY KEY AUTOINCREMENT` — уникальный номер строки,
  SQLite сам присваивает следующий свободный при вставке.
- `TEXT NOT NULL` — тип (строка) и ограничение (не может быть пустым).
- Строка = одна запись (например, один счёт "Kaspi Gold").
- Столбец = одно свойство каждой записи (имя, вид счёта).

## Базовые операции

```sql
-- Получить
SELECT * FROM accounts WHERE kind = 'kaspi_gold';

-- Добавить
INSERT INTO accounts (name, kind) VALUES ('Kaspi Gold', 'kaspi_gold');

-- Изменить
UPDATE accounts SET name = 'Kaspi Gold (основной)' WHERE id = 1;

-- Удалить
DELETE FROM accounts WHERE id = 1;
```

В TS-коде эти запросы передаются как обычные строки, а переменные
значения — отдельным массивом (`$1`, `$2`, ...), НЕ вклеенные прямо в
текст запроса:

```ts
await db.select<StatementRow[]>(
  "SELECT * FROM statements WHERE file_hash = $1",
  [fileHash],
);
```

`$1` — "первое значение из переданного массива". Это называется
**параметризованный запрос**, и это не стилистика — если вместо
`$1` вклеить `fileHash` прямо в строку через `${fileHash}`, это
открывает дорогу SQL-инъекциям (а для чисел/дат часто просто ломает
запрос на спецсимволах). Правило в этом проекте: значения — только
через `$N` и отдельный массив параметров, никогда через конкатенацию
строки.

## Foreign key (внешний ключ) — связь между таблицами

```sql
CREATE TABLE splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    category_id INTEGER REFERENCES categories(id),
    amount_tiyin INTEGER NOT NULL
);
```

`transaction_id INTEGER NOT NULL REFERENCES transactions(id)` говорит:
"это поле — ссылка на существующую строку в таблице `transactions`, по
её `id`, и ссылка обязана существовать (`NOT NULL`)". Если включена
проверка внешних ключей (а в этом проекте она включена по умолчанию
через используемую версию sqlx — библиотеку, которая выполняет
SQL-запросы из Rust-кода, см. главу 08), то **нельзя** ни вставить
строку со ссылкой на несуществующий `id`, ни удалить строку, на
которую кто-то ещё ссылается, — такая попытка упадёт с ошибкой
`FOREIGN KEY constraint failed`.

## Миграция — пронумерованный шаг изменения схемы

Схема (список таблиц и их полей) не пишется один раз целиком — она
растёт пошагово, каждый шаг — отдельный файл:

```
src-tauri/migrations/
  0001_init.sql
  0002_category_rules.sql
  0003_transfer_status.sql
  ...
  0010_goals.sql
```

Каждый файл — просто SQL (`CREATE TABLE ...`, иногда `ALTER TABLE ...`),
который выполняется РОВНО ОДИН РАЗ, в порядке номеров, и SQLite
запоминает, какие номера уже применены (чтобы не прогнать `0005`
заново при следующем запуске). Список миграций и их порядок
регистрируется в Rust-коде:

```rust
// src-tauri/src/lib.rs (сокращённый фрагмент)
let migrations = vec![
    Migration { version: 1, description: "init_schema", sql: include_str!("../migrations/0001_init.sql"), kind: MigrationKind::Up },
    Migration { version: 2, description: "category_rules", sql: include_str!("../migrations/0002_category_rules.sql"), kind: MigrationKind::Up },
    // ... и так далее до version: 10
];
```

Почему не один огромный файл со всей схемой сразу: приложение уже
стоит у пользователя с какой-то версией базы, и при обновлении
приложения нужно довести ЕГО файл `dinero.db` до новой схемы, не
удаляя данные — миграции применяются по порядку, по одной, только те,
что ещё не были применены на этой конкретной базе.

## Реальный баг: забытый внешний ключ при удалении

В Dinero есть функция `deleteStatement` — удаляет загруженную выписку
и все её транзакции. Проблема: когда появились таблицы `trades`,
`dividends`, `debts`, `goal_links` (каждая со своим `REFERENCES
transactions(id)`), удаление транзакции, на которую ссылается хоть
одна строка в этих таблицах, стало падать с ошибкой нарушения
внешнего ключа — а вызывающий код эту ошибку не ловил (глава 03), так
что кнопки "удалить"/"заменить" в интерфейсе выглядели так, будто
просто ничего не делают.

Исправление — перед удалением самих транзакций явно разобраться с
каждой таблицей, которая на них ссылается:

```ts
// src/db/statements.ts:97 (структура сохранена, часть строк показана)
export async function deleteStatement(db: DbClient, statementId: number): Promise<void> {
  const ids = await db.select<{ id: number }[]>(
    "SELECT id FROM transactions WHERE statement_id = $1",
    [statementId],
  );
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const params = ids.map((r) => r.id);

    await db.execute(`DELETE FROM splits WHERE transaction_id IN (${placeholders})`, params);
    // ... transfer_links — похожая логика

    // trades/dividends/goal_links не имеют смысла без своей транзакции
    // (их transaction_id — NOT NULL) — их удаляем вместе с транзакцией:
    await db.execute(`DELETE FROM trades WHERE transaction_id IN (${placeholders})`, params);
    await db.execute(`DELETE FROM dividends WHERE transaction_id IN (${placeholders})`, params);
    await db.execute(`DELETE FROM goal_links WHERE transaction_id IN (${placeholders})`, params);

    // debts/debt_repayments/goal_contributions хранят свою сумму/дату
    // отдельно (transaction_id там не NOT NULL) — их не удаляем, просто
    // отвязываем от удаляемой транзакции:
    await db.execute(`UPDATE debts SET transaction_id = NULL WHERE transaction_id IN (${placeholders})`, params);
  }

  await db.execute("DELETE FROM transactions WHERE statement_id = $1", [statementId]);
  await db.execute("DELETE FROM statements WHERE id = $1", [statementId]);
}
```

Два разных приёма решают одну и ту же проблему по-разному, в
зависимости от схемы конкретной таблицы:
- **Удалить зависимую строку** (`trades`, `dividends`, `goal_links`) —
  потому что их `transaction_id` объявлен `NOT NULL`: строка без него
  вообще не имеет смысла (сделка без транзакции, которая её
  профинансировала, — не сделка).
- **Отвязать, но оставить** (`debts`, `debt_repayments`,
  `goal_contributions`) — их `transaction_id` может быть `NULL` (это
  уже разрешено схемой — так помечаются ручные записи без привязки к
  банковской операции), и сами эти строки хранят сумму/дату отдельно,
  так что запись долга остаётся осмысленной даже без ссылки на
  исходную транзакцию.

Это общий принцип: когда удаляешь строку, на которую может что-то
ссылаться, сначала нужно решить про КАЖДУЮ ссылающуюся таблицу — удалить
зависимые строки вместе с ней, или просто обнулить ссылку (`SET
transaction_id = NULL`), — и явно выполнить это ДО самого `DELETE`.
SQLite сам по себе не делает это автоматически, если в определении
таблицы не написано `ON DELETE CASCADE`/`ON DELETE SET NULL` — а в
схеме Dinero таких автоматических правил на `transactions` нет вообще,
поэтому вся эта логика написана явно, в коде.

## Итог главы

Таблицы, `SELECT`/`INSERT`/`UPDATE`/`DELETE`, параметризованные
запросы вместо вклеивания значений в текст, внешние ключи как
гарантия "нельзя оставить ссылку в никуда", и миграции как
пошаговая история изменений схемы — с этим можно читать весь `src/db/`
и `src-tauri/migrations/`. В следующей главе — как Rust-часть
приложения (которая реально выполняет эти SQL-запросы и управляет
окном) общается с React-частью.
