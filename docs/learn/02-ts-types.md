# 02. Система типов

Типы в TS не меняют поведение программы — они только проверяются до
запуска и помогают редактору подсказывать и ловить ошибки. Эта глава —
про саму систему типов, не про синтаксис.

## `type` и `interface` — два способа назвать форму объекта

```ts
type Account = {
  id: number;
  name: string;
};

interface Account2 {
  id: number;
  name: string;
}
```

Для объектов они почти взаимозаменяемы. В этом проекте почти везде
используется `type` (так проще комбинировать типы, см. ниже), `interface`
встречается реже. Реальный пример простого объектного типа:

```ts
// src/db/statements.ts:3
export type StatementRow = {
  id: number;
  account_id: number;
  bank: string;
  period_start: string;
  period_end: string;
  file_hash: string;
  file_name: string;
  imported_at: string;
  closing_balance_tiyin: number | null;
};
```

`closing_balance_tiyin: number | null` — это **union-тип**: значение
может быть числом ИЛИ `null`. Это самый частый способ сказать «поле
может быть пустым» — в отличие от `?` (необязательное поле, которого
может не быть вовсе), здесь поле *всегда есть*, но может *содержать*
`null`.

## Расширение типа через `&` (intersection)

```ts
// src/db/statements.ts:15
export type StatementSummary = StatementRow & {
  account_name: string;
  transaction_count: number;
};
```

`StatementSummary` — это все поля `StatementRow` **плюс** два новых
поля. `&` склеивает два типа в один, у которого есть поля обоих (в
отличие от `|`, который говорит «одно ИЛИ другое», `&` говорит «и то,
и это одновременно»).

## Union-типы как замена enum

```ts
type ImportStatus = "duplicate_file" | "golden_mismatch" | "imported";
```

Это не строка произвольного содержания — TS проверит, что переменная
этого типа равна ровно одному из трёх перечисленных литералов.
Реальный, более развёрнутый пример — **union размеченных объектов**
(discriminated union), где у каждого варианта разный набор полей, а
общее поле (`status`) — "метка", по которой TS понимает, какой именно
вариант перед ним:

```ts
// src/import/importStatement.ts:22
export type ImportResult =
  | { status: "duplicate_file" }
  | { status: "golden_mismatch"; golden: GoldenResult }
  | {
      status: "imported";
      accountKind: string;
      inserted: number;
      skippedDuplicateRows: number;
      insertedIds: number[];
    };
```

Дальше в коде это проверяется так:

```ts
if (result.status === "imported") {
  // здесь TS УЖЕ знает, что у result есть .inserted, .insertedIds и т.д.
  totalInserted += result.inserted;
}
```

До этой проверки `result.inserted` не существовало бы — TS не позволит
обратиться к полю, которого нет у ВСЕХ вариантов union. После проверки
`result.status === "imported"` TS сам «сужает» тип внутри `if`-блока.
Это называется **narrowing** (сужение типа) и это одна из главных
причин, почему discriminated union — такой частый паттерн: компилятор
не даст забыть обработать какой-то из вариантов.

## Необязательные поля (`?`)

```ts
// src/dashboard/presetConfig.ts:28
export type WidgetConfig = {
  id: string;
  type: WidgetType;
  layout: WidgetLayout;
  ownSettings: boolean;
  period?: PeriodSpec;       // может отсутствовать
  groupMode?: GroupMode;     // может отсутствовать
  filters?: AnalyticsFilters; // может отсутствовать
};
```

`period?: PeriodSpec` — на самом деле тип поля `PeriodSpec | undefined`,
и при обращении `widget.period` TS заставит сначала проверить, что
оно не `undefined` (либо через `if`, либо через `??`, либо через `?.`
— см. ниже).

## `?.` — безопасный доступ

```ts
const groupMode = widget.ownSettings ? widget.groupMode ?? effective.groupMode : effective.groupMode;
```

(реальная строка из `src/features/dashboard/DashboardScreen.tsx`) —
если `widget.groupMode` есть, берём его, иначе (`??`) — `effective.groupMode`.

`?.` — похожий оператор, но для вызова метода/обращения к полю,
которого самого объекта может не быть:

```ts
containerRef.current
  ?.querySelector(`#hub-section-${id}`)
  ?.scrollIntoView({ behavior: "smooth", block: "start" });
```

(реальная строка из `src/features/files/FilesHubScreen.tsx`) — если
`containerRef.current` равен `null`, вся цепочка останавливается и
просто ничего не делает, вместо падения с ошибкой "cannot read
property of null".

## Generics — функция/тип, параметризованный типом

Представь функцию, которая работает с массивом *любого* типа, но
должна вернуть массив того же типа:

```ts
function firstOrNull<T>(items: T[]): T | null {
  return items.length > 0 ? items[0] : null;
}

firstOrNull([1, 2, 3]);        // T вывелся как number, результат: number | null
firstOrNull(["a", "b"]);       // T вывелся как string, результат: string | null
```

`<T>` — это и есть generic-параметр: "какой-то тип, я пока не знаю
какой, но вход и выход должны быть согласованы между собой". Реальный
пример из проекта:

```ts
// src/parsers/dedup.ts
export function assignDedupKeys<T extends DedupInput>(
  transactions: T[],
): (T & { dedupKey: string })[] {
  ...
}
```

`<T extends DedupInput>` — "T может быть любым типом, но ОБЯЗАТЕЛЬНО
содержащим хотя бы поля `DedupInput`". Возврат `(T & { dedupKey: string })[]`
— "массив того же типа T, что пришёл на входе, плюс добавленное поле
`dedupKey`". То есть если на вход дали транзакцию с 10 полями, на
выходе получишь ту же транзакцию с теми же 10 полями плюс одно новое —
и TS это проверит, не разрешив, скажем, забыть использовать
какое-то из исходных полей результата.

## Utility-типы: готовые «преобразователи» типов

TS поставляется с набором встроенных generic-типов, которые берут один
тип и производят из него другой:

| Тип | Что делает |
|-----|------------|
| `Record<K, V>` | объект-словарь: ключи типа `K`, значения типа `V` |
| `Partial<T>` | тот же `T`, но все поля становятся необязательными |
| `Pick<T, "a" \| "b">` | берёт только перечисленные поля из `T` |
| `Readonly<T>` | тот же `T`, но поля нельзя переназначить |

`Record` в проекте используется постоянно для словарей "ключ → метка":

```ts
// src/app/theme.ts:3
export const THEME_LABELS: Record<ThemeId, string> = {
  dim: "Тёмно-серая (по умолчанию)",
  amoled: "AMOLED (чёрный)",
  slate: "Спокойная (сине-серая)",
};
```

`Partial` + `Pick` вместе — пример посложнее, реальная строка:

```ts
// src/features/dashboard/DashboardScreen.tsx:80
const [overrides, setOverrides] = useState<
  Partial<Pick<PresetConfig, "period" | "groupMode" | "filters">>
>({});
```

Читать изнутри наружу: `Pick<PresetConfig, "period" | "groupMode" | "filters">`
— «тип из трёх полей `PresetConfig`: `period`, `groupMode`, `filters`,
остальные выброшены». `Partial<...>` — «и все три теперь необязательные».
Итог: `overrides` хранит *временные, ещё не сохранённые* изменения
периода/группировки/фильтров — любое из трёх полей может быть задано
или не задано, а остальные поля `PresetConfig` там вообще не нужны.
Без `Partial`/`Pick` пришлось бы заводить отдельный тип с теми же
тремя полями вручную и поддерживать его синхронизацию с `PresetConfig` —
utility-типы избавляют от этого дублирования.

## `as const` и литеральный union из массива

```ts
// src/dashboard/presetConfig.ts:5
export const WIDGET_TYPES = [
  "bar", "line", "donut", /* ... */
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
```

Без `as const` TS решил бы, что `WIDGET_TYPES` — это просто
`string[]` (массив произвольных строк). `as const` говорит «это не
просто массив строк, а неизменяемый набор именно ЭТИХ строковых
литералов». `(typeof WIDGET_TYPES)[number]` — «тип одного элемента
этого массива» — то есть ровно union `"bar" | "line" | "donut" | ...`.
Так список допустимых значений объявляется один раз (сам массив, с
которым можно итерироваться в UI) и одновременно порождает тип,
проверяющий, что где-то в коде не написали опечатку.

## Итог главы

Теперь обозначения вида `StatementRow & {...}`, `WidgetType \| null`,
`Partial<Pick<X, "a">>`, `<T extends ...>` читаются не как магические
символы, а как конкретные операции над типами. В главе 03 — как
работает `Promise<T>`, который встречается в сигнатуре почти каждой
функции `db/`.
