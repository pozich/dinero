# 01. Синтаксис TS/JS

TypeScript — это JavaScript плюс статическая типизация, которая
проверяется *до* запуска (компилятором `tsc`), а при запуске исчезает
без следа: браузер/движок выполняет обычный JavaScript. Отсюда вытекает
первое важное отличие от Lua/Scheme-конфигов, которые ты уже видел:

- **Lua/Scheme-конфиг** читается и выполняется той программой, для
  которой он написан (Hyprland, Thunar), прямо как есть.
- **TS-файл** никто не выполняет напрямую. Он сначала *компилируется*
  (типы проверяются и выбрасываются) в обычный JS, и вот JS выполняет
  либо Node.js (на сервере/в сборке), либо браузерный движок (во
  время работы приложения). В этом проекте типы проверяет `tsc`, а
  код для браузера/вебвью собирает Vite (см. главу 04).

## Переменные: `let` и `const`

```ts
let count = 0;        // можно переназначить
count = count + 1;

const name = "Dinero"; // нельзя переназначить
// name = "другое";    // ошибка компиляции
```

`var` в современном коде не используют (включая этот проект) — у него
другие правила видимости, исторически он источник багов. Везде ниже —
только `let`/`const`.

**Важно:** `const` запрещает переназначить *саму переменную*, а не
изменить то, на что она ссылается. Если `const` хранит объект или
массив, его содержимое менять можно:

```ts
const row = { id: 1, name: "Еда" };
row.name = "Food"; // это ОК — сам объект не переназначен
```

## Типы по умолчанию

TS выводит типы сам, если явно не указать:

```ts
let a = 5;       // TS вывел: number
let b = "hi";    // TS вывел: string
let c = true;    // TS вывел: boolean
```

Явно тип указывается после имени через `:`:

```ts
let amountTiyin: number = 150000;
let fileName: string = "statement.pdf";
```

Про union-типы (`number | null`), интерфейсы и generics — в главе 02,
здесь только база.

## Шаблонные строки

Вместо конкатенации через `+` — строка в обратных кавычках с
`${...}`:

```ts
const bank = "kaspi";
const message = `Банк не распознан: ${bank}`;
```

В проекте это основной способ собирать сообщения для пользователя,
например `FilesScreen.tsx`:

```ts
// src/features/files/FilesScreen.tsx
return `${fileName}: уже загружен, пропущено`;
```

## Массивы и объекты

```ts
const ids: number[] = [1, 2, 3];          // массив чисел
const row: { id: number; name: string } = { id: 1, name: "Еда" };
```

Частые операции над массивами — не циклы `for`, а методы:

```ts
const doubled = ids.map((x) => x * 2);         // новый массив
const big = ids.filter((x) => x > 1);          // новый массив, подмножество
const sum = ids.reduce((acc, x) => acc + x, 0); // свёртка в одно значение
const found = ids.find((x) => x === 2);         // первый подходящий или undefined
```

В реальном коде проекта (`src/import/importStatement.ts`) ровно так же:

```ts
const displayIds = [...new Set(merges.flatMap((m) => [m.manualId, m.importedId]))];
```

`...` здесь — **spread**: разворачивает массив/объект в элементы.
`new Set(...)` — убирает дубликаты (множество не хранит повторы), а
`[...set]` разворачивает множество обратно в массив.

## Деструктуризация

Вместо `const id = obj.id; const name = obj.name;` можно сразу:

```ts
const { id, name } = row;                 // из объекта — по именам полей
const [first, second] = ids;              // из массива — по позиции
const { id: statementId } = row;          // с переименованием
```

Это встречается в проекте в сигнатурах функций напрямую — параметр
сразу "распаковывается":

```ts
// src/features/files/FilesScreen.tsx
async function confirmPending() {
  if (!pending) return;
  const { statement, kind } = pending; // распаковали поля объекта pending
  ...
}
```

## Функции: три формы записи

```ts
// 1. Обычное объявление функции
function add(a: number, b: number): number {
  return a + b;
}

// 2. Функция-выражение, записанная как переменная
const subtract = function (a: number, b: number): number {
  return a - b;
};

// 3. Стрелочная функция — самая частая форма в этом проекте
const multiply = (a: number, b: number): number => a * b;
```

У стрелочной функции с одним выражением (без `{ }`) результат —
значение самого выражения, `return` не пишется. Если нужно несколько
строк — фигурные скобки и явный `return`:

```ts
const describe = (x: number): string => {
  if (x > 0) return "положительное";
  return "неположительное или ноль";
};
```

### Необязательные и дефолтные параметры

```ts
function greet(name: string, greeting?: string): string {
  return `${greeting ?? "Привет"}, ${name}!`;
}
```

`greeting?` — необязательный параметр (тип на самом деле
`string | undefined`). `??` — оператор "если слева `null`/`undefined`,
взять правое значение" (в примере выше: "Привет" по умолчанию).

Реальный пример с дефолтным значением параметра (не `?`, а `= значение`):

```ts
// src/db/transactionsQuery.ts:120
export function queryTransactions(
  db: DbClient,
  filters: TransactionFilters = {},
  sort: SortSpec[] = [],
) { ... }
```

Если `filters` не передали — используется `{}`.

## Модули: `import` / `export`

Каждый `.ts`/`.tsx` файл — отдельный модуль. Что видно снаружи —
решает `export`:

```ts
// file: money.ts
export function formatTiyin(amount: number): string {
  return `${(amount / 100).toFixed(2)} ₸`;
}

export const CURRENCY = "KZT";
```

```ts
// file: SomeScreen.tsx
import { formatTiyin, CURRENCY } from "./money";
```

Это — **именованный экспорт** (named export), в проекте почти всегда
используется именно он (не `export default`), чтобы при импорте было
видно явно, что берётся:

```ts
import { listStatements, deleteStatement } from "../../db/statements";
```

Путь `"../../db/statements"` — относительный, от текущего файла;
`../` поднимается на папку выше, как в терминале.

## Итог главы

Ты теперь можешь прочитать практически любую строчку объявления
переменной, функции или импорта в проекте. Дальше (глава 02) — что
значат все эти `: string`, `?`, `| null`, `<T>` после имён.
