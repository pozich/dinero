# 09. Dinero сверху: папки и одна история от клика до базы

Теперь, когда есть словарь (TS, React, SQL, Tauri), можно смотреть на
сам проект. Полный, терсный список каждого модуля и каждой сигнатуры —
в [`SKELETON.md`](../../SKELETON.md). Здесь — только карта, чтобы
ориентироваться, и одна сквозная история.

## Структура папок (сокращённая — полная версия в SKELETON.md)

```
dinero/
├── src/                      — весь фронтенд (TS + React)
│   ├── App.tsx                — верхний компонент: вкладки, undo-кнопки
│   ├── app/                    — тема, isTypingTarget, вкладки
│   ├── db/                     — весь доступ к SQLite (SELECT/INSERT/...)
│   ├── import/                 — импорт выписки: распознать банк → распарсить → записать
│   ├── parsers/                 — разбор PDF/HTML конкретных банков в структуры
│   ├── ledger/                  — вычисление "леджера": какие операции куда считать
│   ├── analytics/               — агрегация леджера в цифры для графиков
│   ├── dashboard/                — пресеты дашборда, виджеты
│   ├── investments/              — оценка количества акций, FIFO себестоимости
│   ├── debts/                    — расчёт остатков долгов
│   ├── goals/                     — расчёт прогресса/прогноза целей
│   ├── features/                   — сами экраны и диалоги (по папке на функциональность)
│   ├── undo/                        — стек отмены действий (Ctrl+Z)
│   └── reliability/                 — бэкапы, блокировка файла, read-only режим
├── src-tauri/                — весь бэкенд (Rust)
│   ├── src/lib.rs              — точка входа, #[tauri::command]'ы, список миграций
│   ├── src/{backup,lock,vault,logging}.rs — вспомогательные Rust-модули
│   ├── migrations/              — пронумерованные .sql файлы схемы
│   └── capabilities/             — права доступа (глава 08)
└── tests/                    — vitest-тесты, по той же структуре папок, что src/
```

## Как вкладки верхнего уровня соответствуют папкам

`src/App.tsx` рисует три вкладки (см. `src/app/TabBar.tsx`); названия
кнопок самих вкладок короче, чем то, что внутри них на самом деле:

| Вкладка (надпись на кнопке) | Компонент | Основные папки за ней |
|---------|-----------|------------------------|
| Файлы | `FilesHubScreen` | `features/files`, `features/settings`, `features/data` |
| Категории + Операции | `OperationsHubScreen` | `features/categories`, `features/operations` |
| Аналитика | `AnalyticsHubScreen` | `features/analytics`, `features/investments` |

Каждый Hub-компонент — не переключатель (глава 05: это была реальная
правка после фидбека "это должен быть ОБЩИЙ экран, не подвкладки") —
а компонент, монтирующий ОБА своих под-экрана одновременно на одной
прокручиваемой странице, с кнопками-якорями наверху, которые просто
скроллят к секции (`scrollIntoView`, см. главу 02).

## Сквозная история: импорт PDF-выписки

Вот что происходит от момента, когда пользователь перетаскивает PDF в
окно, до появления операций в списке — с указанием, в каком именно
файле какой шаг.

### 1. Drag-and-drop ловится на уровне всего окна (не HTML5 API)

```ts
// src/features/files/FilesScreen.tsx (фрагмент)
import { getCurrentWebview } from "@tauri-apps/api/webview";

useEffect(() => {
  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      handleDroppedPaths(event.payload.paths);
    }
  });
}, []);
```

Это Tauri-специфичный API (не обычный браузерный `ondrop`) — он даёт
РЕАЛЬНЫЕ пути файлов на диске (`event.payload.paths: string[]`),
чего обычный веб-API `DataTransfer` в вебвью не даёт.

### 2. Отделяем PDF от HTML-снимков

```ts
// src/features/files/FilesScreen.tsx:98
async function handleDroppedPaths(paths: string[]): Promise<void> {
  if (readOnly) return;
  const pdfPaths = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
  const htmlPaths = paths.filter((p) => /\.html?$/i.test(p));
  if (pdfPaths.length > 0) await importFromPaths(pdfPaths);
  if (htmlPaths.length > 0) await importSnapshotsFromPaths(htmlPaths);
}
```

(PDF — банковские выписки, HTML — брокерские снимки Halyk для сверки
количества акций; дальше следим только за PDF-веткой.)

### 3. Читаем байты файла через Rust-команду

Фронтенд сам не может читать файлы с диска напрямую (глава 08) —
нужна Rust-команда:

```rust
// src-tauri/src/lib.rs:24
#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}
```

### 4. Определяем банк по тексту первой страницы PDF

```ts
// src/import/detectBank.ts
export async function detectBank(data: Uint8Array): Promise<BankKind | null> {
  // ... открывает PDF через pdfjs-dist, читает текст первой страницы
  // и ищет БИК банка — он надёжнее текста, который может по-разному
  // печататься разными банками
}
```

БИК (банковский идентификационный код) — в PDF он печатается всегда
одинаково, в отличие от названия банка, которое может быть с опечаткой
шрифта в кодировке — поэтому распознавание идёт по регулярке на БИК,
а не по тексту "Kaspi Bank".

### 5. Парсим под конкретный банк

У каждого банка свой формат таблицы в PDF — свой парсер
(`src/parsers/kaspi.ts`, `halyk.ts`, `eurasian.ts`, `bcc.ts`), но все
они возвращают один и тот же тип `ParsedTransaction[]` — дальше по
цепочке код уже не знает и не заботится, из какого банка это пришло.

### 6. Сверка с итогом выписки ("golden check")

```ts
// src/import/importStatement.ts:125 (фрагмент)
const statement = await parseKaspi(data.slice());
const golden = checkGolden(statement);
if (!golden.ok) return { status: "golden_mismatch", golden };
```

`checkGolden` пересчитывает сумму всех распарсенных операций и
сравнивает с итоговым балансом, напечатанным в самой выписке. Если не
совпало — это сигнал, что парсер что-то упустил или опечатался на
сложном случае, и импорт лучше остановить, чем молча записать неверные
данные.

### 7. Дедупликация и запись в базу

```ts
// src/parsers/dedup.ts
export function assignDedupKeys<T extends DedupInput>(
  transactions: T[],
): (T & { dedupKey: string })[] { ... }
```

Каждой операции присваивается детерминированный ключ (счёт + дата +
сумма + описание + порядковый номер повтора за день). Перед вставкой
`insertAll` (внутри `importStatement.ts`) проверяет по этому ключу,
нет ли уже такой операции в базе — если есть, строка пропускается
(это и защищает от повторного импорта того же файла или наложения
периодов двух соседних выписок).

### 8. Появление в леджере

Вставленные строки — это просто строки таблицы `transactions`. Экран
Операций запрашивает их через `queryTransactions` (`src/db/transactionsQuery.ts`),
а аналитика и дашборд — через `computeLedger`/`ledgerQuery` (`src/ledger/`,
`src/db/ledgerQuery.ts`), которые пересчитывают агрегаты "на лету" из
текущего набора строк — не из какого-то отдельно хранимого кэша.

## Итог главы

Один клик/drag-and-drop раскладывается на: Rust-чтение файла →
TS-распознавание банка → TS-парсинг → проверка сходимости →
дедупликация → SQL-вставка → переcчёт леджера при следующем запросе.
Каждый шаг — отдельный маленький модуль с одной обязанностью, что и
позволяет держать всё это в голове по частям, а не целиком. В
последней главе — как находить такие цепочки самому и как после этого
курса читать `SKELETON.md`.
