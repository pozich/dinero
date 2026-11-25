# SKELETON — Dinero, структурный план проекта

Цель этого документа: по нему можно собрать проект **с нуля, офлайн**, без
доступа к текущей реализации. Здесь нет тел функций и бизнес-логики — только
стек, структура, интерфейсы (сигнатуры) и порядок сборки.

Dinero — полностью офлайновое приложение учёта личных финансов: детерминированно
разбирает PDF-выписки казахстанских банков в одну дедуплицированную базу
SQLite, строит аналитику/дашборды/долги/инвестиции/цели поверх неё. Tauri 2 +
React 19 + TypeScript на фронтенде, Rust на бэкенде, всё состояние — локальный
SQLite-файл.

---

## 1. Стек

| Технология | Версия | Назначение |
|---|---|---|
| TypeScript | ~6.0.3 | язык фронтенда |
| React | ^19.1.0 / react-dom ^19.1.0 | UI |
| Vite | ^8.0.16 | сборщик/dev-сервер фронтенда |
| @vitejs/plugin-react | ^6.0.2 | JSX/Fast Refresh плагин для Vite |
| Vitest | ^3 | юнит-тесты фронтенда |
| webdriverio + @wdio/* | ^10.2.0 | e2e-тесты (`e2e/`) |
| @tauri-apps/api | ^2 | JS-биндинги к Tauri runtime (`invoke`, `getCurrentWebview`) |
| @tauri-apps/cli | ^2 | `tauri dev` / `tauri build` |
| @tauri-apps/plugin-sql | ^2 (крейт `tauri-plugin-sql` 2.6.0) | доступ к SQLite из фронтенда через `invoke` |
| @tauri-apps/plugin-dialog | ^2.8.4 | нативные диалоги открытия файла/папки |
| @tauri-apps/plugin-http | ^2.9.0 | единственный сетевой вызов (цены KASE), в обход webview-fetch/CORS |
| pdfjs-dist | ^6.5.438 | разбор PDF-выписок (текстовые слои, без OCR) |
| echarts | ^6.1.0 | все графики (аналитика/инвестиции/цели) |
| react-grid-layout | ^2.3.0 | drag/resize грид дашборда |
| @tanstack/react-virtual | ^3.14.28 | виртуализация таблицы операций |
| Rust | edition 2024 | язык бэкенда (`src-tauri`) |
| tauri | 2.12.7 | нативная оболочка приложения (окно, события, плагины) |
| tauri-build | 2.7.6 | build-time кодогенерация Tauri |
| sqlx (через tauri-plugin-sql) | 0.8.6 (sqlx-sqlite) | реальный SQL-драйвер SQLite |
| libsqlite3-sys | 0.30.1 | связанный (bundled) движок SQLite |
| serde / serde_json | 1.0.229 / 1.0.154 | (де)сериализация на Rust-стороне |
| chrono | 0.4.45 (feature `clock`) | календарная арифметика (ротация бэкапов, логи) |
| dirs | 7.0.0 | путь к конфиг-директории ОС (указатель на vault до старта Tauri) |
| gethostname | 0.5.0 | имя устройства для диалога конфликта блокировки |
| tauri-plugin-opener | 2.7.3 | "показать в файловом менеджере" (папка логов) |
| tauri-plugin-dialog (крейт) | 2.8.4 | бэкенд нативных диалогов |
| tauri-plugin-http (крейт) | 2.9.0 | бэкенд HTTP с доменным allowlist |

Валюта хранится как целое число тийин (минимальная денежная единица), никаких
float для денег.

---

## 2. Структура проекта

```
dinero/
├── index.html                      точка входа Vite (монтирует #root)
├── vite.config.ts                  порт 1420, фикс для Tauri dev, игнор src-tauri
├── package.json                    скрипты npm, зависимости фронтенда
├── CLAUDE.md / SPEC.md / SPEC-2.md / HANDOFF.md   проектная документация/спеки (не часть кода)
├── samples/                        PDF/HTML-образцы банковских выписок для ручного/golden-теста
│
├── src/                            фронтенд (React + TS)
│   ├── main.tsx                    ReactDOM.createRoot, применяет тему, рендерит <App/>
│   ├── App.tsx                     корневой компонент: вкладки, undo-бар, провайдеры контекста
│   ├── testHooks.ts                хуки для e2e/smoke-тестов (на window)
│   │
│   ├── app/                        оболочка приложения, без бизнес-логики
│   │   ├── TabBar.tsx              переключатель вкладок (Файлы / Операции / Аналитика)
│   │   ├── theme.ts                ThemeId, чтение/запись темы в localStorage
│   │   ├── theme.css               все CSS-переменные тем + стили всего приложения
│   │   └── isTypingTarget.ts       общая проверка "курсор сейчас в поле ввода" для хоткеев
│   │
│   ├── db/                         доступ к SQLite — один файл на таблицу/область,
│   │                               каждый экспортирует CRUD-функции, принимающие DbClient
│   │   ├── types.ts                DbClient — узкий интерфейс поверх tauri-plugin-sql
│   │   ├── client.ts               getDb() — ленивая синглтон-инициализация подключения
│   │   └── *.ts                    accounts, categories, categoryTree, categoryRules,
│   │                               transactions, transactionsQuery, transferLinks,
│   │                               manualTransactions, statements, ledgerQuery,
│   │                               recurringSeriesState, dashboardPresets, accountOverview,
│   │                               people, debts, goals, goalLinks, goalRules,
│   │                               goalContributions, goalsOverview, securities,
│   │                               securityPrices, securitySnapshots, trades, dividends,
│   │                               investmentsOverview
│   │
│   ├── parsers/                    чистые функции: Uint8Array/HTML → распарсенная выписка,
│   │                               без обращений к БД
│   │   ├── types.ts                общие типы ParsedTransaction/ParsedStatement
│   │   ├── pdfjsWorker.ts           инициализация pdf.js воркера
│   │   ├── pdfRows.ts               PDF → строки текста с координатами (общий слой)
│   │   ├── kaspi.ts / halyk.ts / bcc.ts / eurasian.ts   банк-специфичные парсеры
│   │   ├── kaspiDeposit.ts / cashMirror.ts   разворачивание зеркальных транзакций
│   │   ├── dedup.ts                 ключи дедупликации, хэш файла
│   │   ├── goldenCheck.ts            проверка итогов выписки против распарсенного
│   │   └── halykSnapshot.ts          разбор HTML-снимка брокерского счёта Halyk
│   │
│   ├── import/                     пайплайн импорта: parsers → db, порядок/дедуп/голден-чек
│   │   ├── detectBank.ts           определение банка по байтам файла
│   │   ├── peekPeriod.ts           быстрая выборка периода без полного парсинга (для сортировки)
│   │   ├── importStatement.ts      весь pipeline одного файла: detect → parse → golden → insert
│   │   ├── importInvestments.ts    то же для инвестиционных операций (trades/dividends)
│   │   ├── applyGoalRules.ts       применение правил целей к только что импортированным строкам
│   │   └── mergeManualCandidates.ts  поиск "это та же операция?" между manual и imported
│   │
│   ├── ledger/                     единый источник правды для "что считается в аналитике"
│   │   ├── computeLedger.ts        транзакции+сплиты+связи → LedgerEntry[] с причинами исключения
│   │   ├── accountBalance.ts       баланс счёта на дату из выписок + транзакций после
│   │   ├── coverage.ts             обнаружение пропусков периодов между выписками
│   │   └── isInvestmentCategory.ts  метка "это инвестиционная категория"
│   │
│   ├── analytics/                  чистые функции над LedgerRow[] — период/группировка/метрики
│   │   ├── period.ts, floatingPeriod.ts   период как диапазон дат + "плавающие" периоды (этот месяц и т.п.)
│   │   ├── filters.ts              применение AnalyticsFilters к набору строк
│   │   ├── selectPeriodRows.ts     строки за период с учётом фильтров — общая точка входа
│   │   ├── grouping.ts             группировка по категории/счёту/контрагенту/дню недели/месяцу
│   │   ├── timeSeries.ts           бакетирование по дням/месяцам, накопительная сумма
│   │   ├── metrics.ts              агрегированные метрики периода + изменения по категориям
│   │   ├── recurringPayments.ts    обнаружение периодических платежей
│   │   └── accuracyWarning.ts      предупреждение о неполноте данных периода
│   │
│   ├── dashboard/
│   │   └── presetConfig.ts         PresetConfig/WidgetConfig + defensive JSON parse/serialize
│   │
│   ├── debts/                      чистые функции долгов (без БД)
│   │   ├── extractPersonName.ts    извлечение имени из описания P2P-перевода
│   │   ├── findRepaymentCandidates.ts  сопоставление непривязанных транзакций с долгами
│   │   └── computeDebtBalances.ts  остатки по долгам из долгов+платежей
│   │
│   ├── investments/                чистые функции инвестиций (без БД, без сети — сеть только в kasePriceSource)
│   │   ├── PriceSource.ts          интерфейс источника цен + типы результата
│   │   ├── kasePriceSource.ts      реализация PriceSource для kase.kz (URL + разбор ответа)
│   │   ├── parseInvestDescription.ts  разбор описания сделки/дивиденда из текста выписки
│   │   ├── estimateQuantity.ts     количество = сумма / цена закрытия дня
│   │   ├── fifo.ts                 себестоимость/реализованный P&L по FIFO
│   │   ├── computePositions.ts     текущие позиции портфеля
│   │   ├── timing.ts               "насколько вовремя купили" относительно средней цены месяца
│   │   ├── whatIf.ts               симуляция альтернативного вложения (депозит/индекс)
│   │   └── goldenCheck.ts          сверка оценённого количества с реальным снимком счёта
│   │
│   ├── goals/                      чистые функции целей накоплений (без БД)
│   │   ├── matchGoalRule.ts        проверка правила автозачисления
│   │   ├── progress.ts             текущая сумма/прогресс цели
│   │   ├── calculator.ts           план "когда/сколько" + разбор "почему"
│   │   └── status.ts               текстовый статус цели (ahead/behind/overdue/…)
│   │
│   ├── review/
│   │   └── buildReviewCandidates.ts  кандидаты в переводы/возвраты, ждущие подтверждения
│   │
│   ├── export/
│   │   └── exportCsv.ts            TransactionListItem[] → CSV-текст
│   │
│   ├── undo/                       общий стек отмены для табличных правок
│   │   ├── undoStack.ts            UndoStack класс + withUndo() helper
│   │   └── UndoContext.tsx         React-провайдер/хуки над UndoStack
│   │
│   ├── reliability/                всё, что не бизнес-логика, а "не потерять данные"
│   │   ├── backups.ts              создание/список/восстановление бэкапов (через invoke)
│   │   ├── lock.ts                 типы конфликта блокировки + invoke-обёртки
│   │   ├── conflicts.ts            invoke-обёртка detect_sync_conflicts
│   │   ├── errorLog.ts             логирование ошибок (через invoke) + глобальный error handler
│   │   ├── ReadOnlyContext.tsx     React-контекст "режим только чтения" (после конфликта блокировки)
│   │   ├── LockConflictDialog.tsx  модалка выбора при конфликте блокировки
│   │   ├── Banners.tsx             баннеры sync-конфликта и read-only режима
│   │   └── useBackButtonClose.ts   системная "назад" закрывает диалог; опционально — просто разметка без диалога
│   │
│   ├── features/                   экранные компоненты, группированы по предметной области
│   │   ├── commandPalette/         Ctrl+K: реестр команд от каждого экрана + сам палитра-UI
│   │   ├── hotkeys/HotkeyOverlay.tsx   оверлей "?" со списком реальных хоткеев
│   │   ├── files/                  экран "Файлы": drag-drop, список выписок, карточки
│   │   ├── settings/SettingsScreen.tsx  выбор темы
│   │   ├── data/DataScreen.tsx     бэкапы/vault-папка/проверить-долги-цели
│   │   ├── categories/             дерево категорий (rename/merge/delete/drag)
│   │   ├── operations/             таблица операций: фильтры, сплиты, правила, bulk-действия
│   │   ├── analytics/              дашборд, графики, метрики, drill-down
│   │   ├── dashboard/              пресеты дашборда, виджеты, grid-layout
│   │   ├── investments/            портфель, сделки, дивиденды, what-if
│   │   ├── debts/                  список долгов, диалоги новый/платёж/простить
│   │   └── goals/                  цели накоплений, карточки, диалоги
│   │
│   └── *HubScreen.tsx (в features/files, /operations, /analytics)
│                                   объединяют несколько экранов в один скроллящийся экран
│                                   с якорной навигацией (не под-вкладки)
│
├── tests/                          Vitest; зеркалирует src/ по областям
│   ├── db/*.test.ts, analytics/*.test.ts, ledger/*.test.ts, parsers/*.test.ts,
│   │   import/*.test.ts, investments/*.test.ts, debts/*.test.ts, goals/*.test.ts,
│   │   dashboard/*.test.ts, export/*.test.ts, features/*.test.ts, review/*.test.ts,
│   │   transfers/*.test.ts, undo/*.test.ts
│   └── testDb.ts                   фабрика DbClient на node:sqlite (better-sqlite3-подобный фейк)
│                                    с наивным транслятором `$N` → `?`
│
├── e2e/                            webdriverio smoke-тест поверх собранного приложения
│   ├── smoke.spec.mjs
│   └── wdio.conf.mjs
│
└── src-tauri/                      бэкенд (Rust)
    ├── Cargo.toml                  крейты и их версии (см. раздел 1)
    ├── tauri.conf.json             окно, dev/build команды, бандл
    ├── build.rs                    tauri-build кодогенерация
    ├── capabilities/default.json   разрешения: sql, dialog, opener, http (allowlist kase.kz)
    ├── migrations/000N_*.sql       последовательные SQL-миграции схемы (см. раздел 6)
    └── src/
        ├── main.rs                 точка входа бинарника, вызывает lib::run()
        ├── lib.rs                  Tauri Builder: плагины, миграции, invoke_handler, команды
        ├── vault.rs                разрешение пути к папке данных + указатель в конфиге ОС
        ├── lock.rs                 файл-блокировка "кто сейчас держит базу" + heartbeat
        ├── backup.rs                создание/ротация/восстановление .db бэкапов на диске
        └── logging.rs              запись ошибок фронтенда в файл лога
```

---

## 3. Модули и компоненты

### `src/db/*` — слой доступа к данным
- **Отвечает за:** весь SQL, маппинг строк в типы TS. Каждая функция принимает
  `db: DbClient` первым параметром (без скрытого состояния) — так тесты
  подставляют node:sqlite-фейк вместо настоящего Tauri-плагина.
- **Зависит от:** `db/types.ts` (интерфейс `DbClient`), `db/client.ts`
  (`getDb()`), ничего из `features/`.
- **Экспортирует:** типы строк таблиц + CRUD/query-функции по областям
  (см. раздел 4).

### `src/parsers/*` — разбор банковских файлов
- **Отвечает за:** превращение сырых байт PDF/HTML в `ParsedStatement`/
  `ParsedSnapshot`, без побочных эффектов (ничего не пишет в БД, не обращается
  к сети).
- **Зависит от:** pdf.js (через `pdfjsWorker.ts`/`pdfRows.ts`), `parsers/types.ts`.
- **Экспортирует:** по одному `parseXxx(data): Promise<ParsedXxxStatement>` на
  банк + общие хелперы (`dedup.ts`, `goldenCheck.ts`, зеркала).

### `src/import/*` — пайплайн импорта
- **Отвечает за:** оркестрацию "файл → распарсено → проверено голден-чеком →
  записано в БД → дедуп → предложены правила/цели/мерджи".
- **Зависит от:** `parsers/*`, `db/*`.
- **Экспортирует:** `importStatement`, `importInvestmentRows`, `detectBank`,
  `peekPeriodStart`, `findMergeCandidates`, `applyGoalRulesToTransactions`.

### `src/ledger/*` — единый источник "что считается операцией"
- **Отвечает за:** исключение транзитных/игнорируемых/переводных/возвратных/
  инвестиционных/долговых строк из обычного учёта, с явной причиной
  исключения на каждой строке.
- **Зависит от:** только от сырых типов (`db/transactionsQuery.ts` формы
  строк), не делает запросов сам (принимает уже выбранные массивы).
- **Экспортирует:** `computeLedger`, `computeAccountBalances`,
  `findCoverageGaps`/`monthlyCoverage`, `isInvestmentCategory`.

### `src/analytics/*` — агрегация LedgerRow[]
- **Отвечает за:** период → группировка → метрики → временные ряды, всё как
  чистые функции без React и без БД.
- **Зависит от:** `src/ledger` (типы строк).
- **Экспортирует:** см. раздел 4; основная точка входа — `selectPeriodRows`.

### `src/dashboard/presetConfig.ts`
- **Отвечает за:** защищённый парсинг/сериализацию конфигурации пресета
  (неизвестные поля игнорируются, отсутствующие — дефолтятся, невалидные
  виджеты выбрасываются) — хранится как JSON-строка в `dashboard_presets.config`.
- **Зависит от:** ничего внутри проекта.
- **Экспортирует:** `defaultPresetConfig`, `parsePresetConfig`,
  `serializePresetConfig`, типы `PresetConfig`/`WidgetConfig`/`WidgetType`.

### `src/debts/*`, `src/investments/*`, `src/goals/*`
- **Отвечает за:** предметную бизнес-логику соответствующей области как чистые
  функции (без БД/React) — специально отделены от `db/*`, чтобы юнит-тесты не
  трогали SQLite вовсе.
- **Зависит от:** друг от друга минимально; `investments/kasePriceSource.ts` —
  единственное место, которое реально обращается к сети (через
  `@tauri-apps/plugin-http`, вызывается из UI-слоя `features/investments`).
- **Экспортирует:** см. раздел 4.

### `src/undo/*`
- **Отвечает за:** общий механизм "откатить правку таблицы" — перед
  изменением `UndoStack` снимает снимок затронутых строк по
  `{table, whereSql, params}`, `withUndo()` оборачивает мутацию снимком.
- **Зависит от:** `db/types.ts` (DbClient).
- **Экспортирует:** `UndoStack`, `withUndo`, `UndoProvider`/`useUndoStack`/`useUndoState`.

### `src/reliability/*`
- **Отвечает за:** всё вокруг "не потерять и не повредить данные" —
  бэкапы, файл-блокировка между устройствами, read-only режим,
  логирование, диалог закрытия по системной "назад".
- **Зависит от:** `@tauri-apps/api` (`invoke`) для Rust-команд.
- **Экспортирует:** см. раздел 4.

### `src/features/commandPalette/*`
- **Отвечает за:** Ctrl+K — каждый смонтированный экран регистрирует свой
  список команд под своим `groupId`, палитра показывает их объединённый
  список с фильтром по подстроке.
- **Зависит от:** React Context.
- **Экспортирует:** `CommandProvider`, `useRegisterCommands`,
  `useAllCommands`, `CommandPalette`, `searchPalette`.
  **Важно:** `useRegisterCommands` обязан зависеть от стабильных
  `register`/`unregister`, а не от всего объекта контекста — иначе
  регистрация нескольких экранов одновременно вызывает бесконечный ре-рендер.

### `src/features/*Hub*Screen.tsx` (files/operations/analytics)
- **Отвечает за:** объединение нескольких полноценных экранов в один
  скроллящийся экран с якорной верхней навигацией (`scrollIntoView`), а не
  переключением видимого контента.
- **Зависит от:** объединяемые экраны остаются самостоятельными компонентами
  и могут при необходимости рендериться и отдельно/модально (см.
  `CategoriesScreen`, у которого `onClose` — опционален: без него рисует
  себя как обычный блок, с ним — как модалку).

### `src/App.tsx` / `src/app/*`
- **Отвечает за:** корневой layout (вкладки + undo-бар + баннеры), глобальные
  хоткеи (переключение вкладки, undo/redo), применение сохранённой темы при
  старте.
- **Зависит от:** все провайдеры контекста (`ReadOnlyProvider`, `UndoProvider`,
  `CommandProvider`), три `*HubScreen`/`OperationsHubScreen`.

### Rust: `src-tauri/src/*`
- **`lib.rs`** — точка сборки приложения: регистрирует плагины
  (`tauri-plugin-sql` с миграциями, `dialog`, `opener`, `http`), управляемое
  состояние (`VaultState`, `LockConflict`), обработчик окна (освобождение
  блокировки при закрытии), и список всех `#[tauri::command]`.
- **`vault.rs`** — куда физически лежит `dinero.db` (указатель в конфиг-папке
  ОС, может быть переопределён пользователем).
- **`lock.rs`** — файл-блокировка `*.lock` рядом с базой: кто и когда открыл
  базу последним, героический heartbeat каждые 60 с, обнаружение "кто-то
  другой уже открыл".
- **`backup.rs`** — копии `.db`-файла по причинам (`startup`/`import`/…),
  ротация, восстановление.
- **`logging.rs`** — запись ошибок фронтенда построчно в файл в vault-папке.
- Всё это вызывается с фронтенда через `invoke("имя_команды", {...})`.

---

## 4. Функции и классы

Группировка — по модулю, в порядке файлов. Подписи взяты из текущих
экспортов; `DbClient` — общий интерфейс `{ select, execute }` над SQLite.

### `src/db/client.ts`, `src/db/types.ts`
- `getDb(): Promise<DbClient>` — ленивая синглтон-инициализация подключения (плюс `PRAGMA journal_mode = DELETE`).
- `interface DbClient { select<T>(query, bindValues?): Promise<T>; execute(query, bindValues?): Promise<QueryResult> }` — узкий контракт поверх `@tauri-apps/plugin-sql`.

### `src/db/accounts.ts`
- `listAccounts(db): Promise<Account[]>` — все счета.
- `getAccountIdByKind(db, kind): Promise<number>` — id счёта по его виду (`kaspi_gold`, …).

### `src/db/categories.ts`, `categoryTree.ts`
- `listCategories(db): Promise<Category[]>` — все категории плоским списком.
- `findOrCreateCategory(db, name, parentId?): Promise<number>` — найти по имени или создать.
- `renameCategory(db, id, name): Promise<void>` — переименование.
- `moveCategory(db, id, newParentId): Promise<void>` — перенос в дереве.
- `setCategoryAppearance(db, id, ...): Promise<void>` — иконка/цвет категории.
- `mergeCategories(db, sourceId, targetId): Promise<void>` — слияние двух категорий.
- `deleteCategory(db, id, reassignToId: number | null): Promise<void>` — удаление с переназначением операций.
- `listCategoryCounts(db): Promise<CategoryCount[]>` — число операций и сумма по каждой категории.

### `src/db/categoryRules.ts`
- `listCategoryRules(db): Promise<CategoryRule[]>` — все правила.
- `createCategoryRule(db, input): Promise<number>` — создать правило.
- `updateCategoryRule(db, id, patch): Promise<void>` — изменить правило.
- `deleteCategoryRule(db, id): Promise<void>` — удалить правило.
- `moveCategoryRule(db, id, direction): Promise<void>` — изменить приоритет правила.

### `src/db/transactions.ts`
- `findTransactionByDedupKey(db, key): Promise<...>` — поиск дубликата перед вставкой.
- `insertTransaction(db, input): Promise<number>` — вставка одной транзакции.
- `setTransactionNote(db, id, note): Promise<void>` — заметка к операции.
- `setTransactionIgnored(db, id, ignored): Promise<void>` — пометка "не учитывать".
- `insertTransferLink(db, fromId, toId, {status, kind}): Promise<...>` — связь перевода/возврата.
- `setTransactionCategory(db, id, categoryId, amountTiyin): Promise<void>` — простая (без сплита) категория.
- `setTransactionSplits(db, id, splits: SplitInput[]): Promise<void>` — разбиение операции на несколько категорий.

### `src/db/transactionsQuery.ts`
- `buildTransactionsQuery(filters, sort): {sql, params}` — построение SQL под фильтры/сортировку таблицы операций.
- `queryTransactions(db, filters, sort?): Promise<TransactionListItem[]>` — выполнение запроса.

### `src/db/transferLinks.ts`
- `pairKey(a, b): string` — канонический ключ пары id для анти-дублирования связей.
- `confirmTransferLink(db, id): Promise<...>` / `rejectTransferLink(db, id): Promise<...>` — подтвердить/отклонить кандидата.
- `unlinkTransferLink(db, id): Promise<void>` — удалить связь.
- `listConfirmedLinksForTransaction(db, transactionId): Promise<TransferLink[]>` — связи конкретной операции.
- `listConfirmedTransactionIds(db): Promise<Set<number>>` — все id, участвующие в подтверждённых связях.
- `listRejectedPairs(db): Promise<Set<string>>` — отклонённые пары (чтобы не предлагать снова).

### `src/db/manualTransactions.ts`
- `listManualTransactions(db): Promise<MatchableTransaction[]>` — все ручные операции.
- `listTransactionsByIdsMatchable(db, ids): Promise<MatchableTransaction[]>` — выборка для сверки с импортом.
- `insertManualTransaction(db, input): Promise<number>` — создать ручную операцию.
- `updateManualTransaction(db, id, patch): Promise<void>` — изменить.
- `deleteManualTransaction(db, id): Promise<void>` — удалить (с очисткой связей).
- `mergeManualIntoImported(db, manualId, importedId): Promise<void>` — слить ручную запись с импортированным дублем.

### `src/db/statements.ts`
- `findStatementByHash(db, hash): Promise<...>` — поиск уже загруженного файла.
- `insertStatement(db, input): Promise<number>` — зарегистрировать выписку.
- `listStatements(db): Promise<StatementSummary[]>` — список с именем счёта и числом операций.
- `countCategorizedTransactions(db, statementId): Promise<number>` — сколько операций уже разложено по категориям (для предупреждения перед удалением).
- `deleteStatement(db, statementId): Promise<void>` — удалить выписку и всё, что на её транзакции ссылается (splits, transfer_links, trades/dividends/goal_links — удаляются; debts/debt_repayments/goal_contributions — отвязываются, `transaction_id = NULL`).

### `src/db/ledgerQuery.ts`
- `queryLedger(db, filters?): Promise<LedgerRow[]>` — выборка строк для `computeLedger`.

### `src/db/recurringSeriesState.ts`
- `listRecurringSeriesState(db, ...): Promise<RecurringSeriesState[]>` — сохранённые пользовательские решения по сериям.
- `setSeriesHidden(db, seriesKey, hidden): Promise<void>`, `setSeriesConfirmed(db, seriesKey, confirmed): Promise<void>`.

### `src/db/dashboardPresets.ts`
- `listPresets(db): Promise<DashboardPreset[]>` — все пресеты.
- `createPreset(db, name, icon, config): Promise<number>` — новый пресет.
- `updatePresetConfig(db, id, config): Promise<void>` — сохранить конфиг.
- `renamePreset(db, id, name, icon): Promise<void>`, `deletePreset(db, id): Promise<void>`, `duplicatePreset(db, id): Promise<number>`.
- `reorderPresets(db, orderedIds): Promise<void>` — порядок вкладок-пресетов.
- `setDefaultPreset(db, id): Promise<void>` — пресет по умолчанию при старте.
- `ensureStarterPresets(db): Promise<void>` — создать стартовые пресеты при первом запуске.

### `src/db/accountOverview.ts`
- `queryAccountOverview(db): Promise<AccountOverview[]>` — баланс+метаданные каждого счёта.

### `src/db/people.ts`
- `listPeople(db): Promise<Person[]>`, `listAllAliasesByPerson(db): Promise<Map<number,string[]>>`.
- `findOrCreatePersonByAlias(db, alias): Promise<number>` — найти человека по алиасу или создать.
- `createPerson(db, name): Promise<number>`, `renamePerson(db, id, name): Promise<void>`.
- `addAlias(db, personId, alias): Promise<void>`, `mergePeople(db, targetId, sourceId): Promise<void>`.

### `src/db/debts.ts`
- `listDebts(db): Promise<Debt[]>`, `listRepayments(db): Promise<DebtRepayment[]>`.
- `listTransactionsNotLinkedToAnyDebt(db): Promise<UnlinkedTransaction[]>` — кандидаты для разметки как долг.
- `createDebt(db, input: CreateDebtInput): Promise<number>`, `deleteDebt(db, id): Promise<void>`.
- `recordRepayment(db, ...): Promise<...>`, `deleteRepayment(db, id): Promise<void>`.
- `forgiveDebt(db, ...): Promise<...>` — прощение долга реальной расходной операцией.

### `src/db/goals.ts`, `goalLinks.ts`, `goalRules.ts`, `goalContributions.ts`, `goalsOverview.ts`
- `listGoals(db): Promise<Goal[]>`, `createGoal(db, input): Promise<number>`, `updateGoal(db, id, patch): Promise<void>`.
- `setGoalStatus(db, id, status): Promise<void>`, `deleteGoal(db, id): Promise<void>`, `reorderGoals(db, orderedIds): Promise<void>`.
- `linkTransactionToGoal(db, goalId, transactionId): Promise<void>`, `unlinkTransaction(db, transactionId): Promise<void>`.
- `listLinkedTransactionIds(db, goalId): Promise<number[]>`, `getGoalIdForTransaction(db, transactionId): Promise<number|null>`.
- `listGoalRules(db, goalId?): Promise<GoalRuleRow[]>`, `createGoalRule(db, goalId, rule): Promise<number>`, `deleteGoalRule(db, id): Promise<void>`.
- `listContributions(db, goalId): Promise<GoalContribution[]>`, `addContribution(db, ...): Promise<...>`, `deleteContribution(db, id): Promise<void>`, `contributionExistsForTransaction(db, transactionId): Promise<boolean>`.
- `queryGoalsOverview(db, now?): Promise<GoalOverviewItem[]>`, `computeAverageIncomeExpense(db, ...): Promise<...>`.

### `src/db/securities.ts`, `securityPrices.ts`, `securitySnapshots.ts`, `trades.ts`, `dividends.ts`, `investmentsOverview.ts`
- `listSecurities(db): Promise<Security[]>`, `getSecurity(db, isin): Promise<Security|null>`, `upsertSecurity(db, security): Promise<void>`, `deleteSecurity(db, isin): Promise<void>`.
- `listPrices(db, isin): Promise<DailyPrice[]>`, `getPriceOnOrBefore(db, isin, date): Promise<number|null>`, `getLatestPriceDate(db, isin): Promise<string|null>`, `upsertPrices(db, isin, prices): Promise<void>`.
- `refreshPrices(db, ...): Promise<PriceRefreshResult[]>` — обновление кэша цен через `PriceSource`.
- `listSnapshots(db, isin?): Promise<SnapshotRow[]>`, `importSnapshot(db, parsed): Promise<void>`.
- `listTrades(db): Promise<TradeRow[]>`, `listTradesByIsin(db, isin): Promise<TradeRow[]>`, `findOrCreateSecurityByTicker(db, ticker): Promise<string>`, `insertTrade(db, input): Promise<number>`, `setEstimatedQuantity(db, tradeId, quantity): Promise<void>`, `tradeExistsForTransaction(db, transactionId): Promise<boolean>`.
- `listDividends(db): Promise<DividendRow[]>`, `listDividendsByIsin(db, isin): Promise<DividendRow[]>`, `insertDividend(db, input): Promise<number>`, `dividendExistsForTransaction(db, transactionId): Promise<boolean>`.
- `queryInvestmentsOverview(db, now?): Promise<InvestmentsOverview>`.

### `src/parsers/*`
- `ensurePdfWorker(): Promise<void>` — инициализация pdf.js воркера.
- `extractPageRows(doc, pageNum, ...): Promise<Row[]>`, `extractDocumentRows(doc): Promise<Row[]>`, `rowText(row): string`.
- `parseKaspi(data): Promise<ParsedStatement>`, `parseHalyk(data): Promise<ParsedHalykStatement>`, `parseBcc(data): Promise<ParsedBccStatement>`, `parseEurasian(data): Promise<ParsedEurasianStatement>`.
- `parseHalykSnapshot(html): ParsedSnapshot` — HTML-снимок брокерского счёта.
- `expandKaspiDepositMirrors(transactions): {...}`, `expandCashMirrors(transactions): {...}` — разворачивание зеркальных транзакций.
- `assignDedupKeys(items): T[]`, `hashFile(data): Promise<string>`.
- `checkGolden(statement): GoldenResult` — сверка итогов файла с распарсенным.

### `src/import/*`
- `detectBank(data): Promise<BankKind | null>`.
- `peekPeriodStart(data): Promise<string | null>` — быстрая оценка периода без полного парсинга.
- `importStatement(db, data, fileName): Promise<ImportResult>` — главный пайплайн импорта одного файла.
- `importInvestmentRows(db, ...): Promise<...>` — то же для инвестиционных операций.
- `findMergeCandidates(manualPool, importedPool): MergeCandidate[]`.
- `applyGoalRulesToTransactions(db, ...): Promise<...>`.

### `src/ledger/*`
- `computeLedger(transactions, splits, links, categories, debtTransactionIds?): LedgerEntry[]` — главная функция: решает, что считается операцией и почему что-то исключено.
- `computeAccountBalances(accountTx, statements): AccountBalanceResult[]`.
- `findCoverageGaps(periods): DateRange[]`, `monthlyCoverage(periods): ...`.
- `isInvestmentCategory(category): boolean`.

### `src/analytics/*`
- `currentPeriod(kind, now?): Period`, `shiftPeriod(period, kind, direction): Period`, `comparisonPeriod(period, kind, mode): Period`, `formatPeriodLabel(period, kind): string`, `periodDelta(...): ...`.
- `resolveFloatingPeriod(id, now?): Period`, `resolvePeriodSpec(spec, now?): Period`.
- `applyAnalyticsFilters(rows, filters): LedgerRow[]`.
- `selectPeriodRows(allRows, period, filters): LedgerRow[]` — основная точка входа для виджетов.
- `groupLedgerRows(rows, mode): GroupBucket[]`, `groupByCategoryTree(rows, categories): CategoryTreeBucket[]`.
- `chooseBucketGranularity(period): BucketGranularity`, `bucketLedgerRows(rows, granularity): TimeBucket[]`, `cumulativeNet(buckets): number[]`.
- `buildAccuracyWarning(...): AccuracyWarning`, `isAccuracyWarningEmpty(w): boolean`, `formatAccuracyWarning(w): string`.
- `computeMetrics(rows, ...): Metrics`, `computeCategoryChanges(current, previous): CategoryChange[]`.
- `findRecurringSeries(rows): RecurringSeries[]`.

### `src/dashboard/presetConfig.ts`
- `defaultPresetConfig(): PresetConfig`.
- `parsePresetConfig(raw: string): PresetConfig` — защищённый парсинг JSON из БД.
- `serializePresetConfig(config): string`.

### `src/debts/*`
- `extractPersonName(description): string | null`.
- `findRepaymentCandidates(unlinked, debts): DebtRepaymentCandidate[]`.
- `computeDebtBalances(debts, repayments, people): PersonDebtSummary[]`.

### `src/investments/*`
- `buildKaseHistoryUrl(ticker, from, to): string`, `parseKaseHistoryResponse(json): PriceSourceResult` — единственное место, формирующее сетевой запрос.
- `parseTradeDescription(description): ParsedTrade | null`, `parseDividendDescription(description): ParsedDividend | null`.
- `estimateQuantity(amountTiyin, closeTiyin): number | null`.
- `computeFifo(trades): FifoResult`.
- `computePosition(trades, ...): Position`, `fillPortfolioShares(positions): Position[]`.
- `computeTimingPercent(purchasePriceTiyin, monthAveragePriceTiyin): number | null`.
- `simulateDeposit(cashFlows, annualRatePercent, asOfDate): number`, `simulateIndex(...): ...`.
- `checkGolden(trades, snapshots): GoldenCheckRow[]` — сверка оценённого количества с реальным снимком.

### `src/goals/*`
- `matchesGoalRule(rule, transaction): boolean`.
- `computeGoalCurrentTiyin(location, ...): number`, `sumContributions(contributions): number`, `averageMonthlyContribution(...): number`.
- `computeGoalPlan(progress, now?): GoalPlan` — план "когда/сколько".
- `computeWhyBreakdown(...): WhyBreakdown`, `monthlyToProjectedDate(remainingTiyin, monthlyTiyin, now?): string | null`, `dateToRequiredMonthly(remainingTiyin, deadline, now?): number | null`.
- `computeGoalStatusLabel(plan, monthlyContributionTiyin): GoalStatusLabel`.

### `src/review/buildReviewCandidates.ts`
- `listCandidatePool(db): Promise<ReviewTransaction[]>`.
- `buildReviewCandidates(db): Promise<ReviewCandidate[]>` — кандидаты в переводы/возвраты.

### `src/export/exportCsv.ts`
- `buildCsv(rows, categories): string`.

### `src/undo/*`
- `class UndoStack` — стек снимков для Ctrl+Z/Ctrl+Shift+Z.
- `withUndo(stack, label, tableSpecs, mutate): Promise<...>` — снимок + выполнение мутации.
- `UndoProvider({children})`, `useUndoStack(): UndoStack | null`, `useUndoState(): {stack, canUndo, canRedo}`.

### `src/reliability/*`
- `backupBefore(reason): Promise<void>`, `listBackups(): Promise<BackupMeta[]>`, `restoreBackup(name): Promise<void>`.
- `getLockConflict(): Promise<LockInfo | null>`, `resolveLockConflict(choice): Promise<void>`.
- `detectSyncConflicts(): Promise<string[]>`.
- `logError(kind, location, detail?): void`, `openLogsFolder(): Promise<void>`, `installGlobalErrorLogging(): void`.
- `ReadOnlyProvider({children})`, `useReadOnly(): boolean`, `useSetReadOnly(): (value: boolean) => void`.
- `useBackButtonClose(onClose?): void` — опционален: без `onClose` ничего не делает (режим постоянного инлайн-экрана).

### `src/features/commandPalette/*`
- `CommandProvider({children})`.
- `useRegisterCommands(groupId, commands): void`.
- `useAllCommands(): PaletteCommand[]`.
- `searchPalette(items, query): T[]`.

### `src/features/operations/*` (чистые хелперы, без React)
- `selectSingle(id): Set<number>`, `toggleSelection(selected, id): Set<number>`, `selectRange(rows, fromId, toId): Set<number>`, `selectAll(rows): Set<number>`.
- `toggleSort(current, column): SortSpec[]`, `addSecondarySort(current, column): SortSpec[]`.
- `normalizeRect(x1,y1,x2,y2): Rect`, `rectsIntersect(a,b): boolean` — выделение рамкой мышью.
- `detectSwipe(...): ...` — свайп-жест на таблице (телефон).
- `compileRule(rule): RegExp | null`, `testPattern(description, rule): boolean`, `matchRule(t, rule): boolean`, `findMatchingCategory(t, rules): ...` — правила категоризации.
- `reorderColumns(columns, from, to): ColumnConfig[]`, `resizeColumn(columns, key, width): ColumnConfig[]`, `toggleColumnVisibility(columns, key): ColumnConfig[]`, `mergeWithDefaults(saved): ColumnConfig[]`.
- `formatTransactionDate(isoDate, showYear): string`, `spansMultipleYears(isoDates): boolean`.
- `formatTiyin(amountTiyin): string`, `parseTiyinInput(text): number | null`.

### `src/features/categories/buildCategoryTree.ts`
- `buildCategoryTree(categories): TreeNode[]`, `flattenCategoryTree(nodes): Category[]`.

### `src/features/files/goldenMismatch.ts`
- `formatGoldenMismatch(golden): string`.

### `src/features/dashboard/widgetRegistry.tsx`
- `renderWidget(config, ctx): ReactNode` — диспетчер типа виджета → компонент.
- Константы: `WIDGET_LABELS`, `DEFAULT_WIDGET_LAYOUT`.

### Ключевые экранные компоненты (пропсы см. в файлах, здесь — назначение)
- `App.tsx: App()` — корень приложения.
- `app/TabBar.tsx: TabBar({active, onChange})` — переключатель вкладок.
- `app/theme.ts: getStoredTheme(): ThemeId`, `applyTheme(theme): void`.
- `features/files/FilesHubScreen.tsx: FilesHubScreen()` — Файлы+Настройки+Данные как один экран.
- `features/operations/OperationsHubScreen.tsx: OperationsHubScreen()` — Категории+Операции как один экран.
- `features/analytics/AnalyticsHubScreen.tsx: AnalyticsHubScreen()` — Аналитика+Инвестиции как один экран.
- `features/files/FilesScreen.tsx: FilesScreen()`, `StatementCard({statement, onDelete?, onReplace?})`, `ConfirmDialog({...})`, `MergeManualDialog({...})`.
- `features/settings/SettingsScreen.tsx: SettingsScreen()` — выбор темы.
- `features/data/DataScreen.tsx: DataScreen()` — бэкапы, vault-папка, счётчики проверки/долгов/целей.
- `features/categories/CategoriesScreen.tsx: CategoriesScreen({onClose?})` — дерево категорий; без `onClose` — инлайн-блок, с ним — модалка.
- `features/operations/OperationsScreen.tsx: OperationsScreen()`, `OperationsTable({...})`, `CategorySidebar({...})`, `BulkActionBar({...})`, `CategoryInput({...})`, `SplitDialog`, `RulesDialog`, `ApplyRulesDialog`, `ApplyToSimilarDialog`, `ManualLinkDialog`, `ManualTransactionDialog`.
- `features/analytics/AnalyticsScreen.tsx: AnalyticsScreen()`, `EChart({option, ...})` — обёртка над echarts (импортируется только из lazy-точек входа), `MetricCards`, `AccountsOverview`, `AccuracyBanner`, `ChartTypeSwitcher`, `CategoryTreeTable`, `RecurringPaymentsPanel`, `DrillDownDialog`.
- `features/dashboard/DashboardScreen.tsx: DashboardScreen({allRows, categories, accounts, accountOverviews, recurringSeries, recurringState, onDrillDown, onSetHidden, onSetConfirmed})`, `PresetChips`, `PresetNameDialog`, `AddWidgetMenu`, `WidgetFrame`.
- `features/investments/InvestmentsScreen.tsx: InvestmentsScreen()`, `PortfolioOverview`, `PositionsTable`, `TradeHistoryTable`, `DividendsCalendar`, `StockChart`, `PlayedCards`, `UpdatePricesButton`, `UploadSnapshotButton`.
- `features/debts/DebtsScreen.tsx: DebtsScreen({onClose, onCountChange?})`, `NewDebtDialog`, `RecordRepaymentDialog`, `ForgiveDebtDialog`, `MarkDebtDialog`, `PersonInput`.
- `features/goals/GoalsScreen.tsx: GoalsScreen({onClose, onCountChange?})` (и `GoalsScreenLazy` — ленивая обёртка), `GoalCard`, `NewGoalDialog`, `ContributionDialog`, `LinkToGoalDialog`, `GoalWidgetSummary`.
- `features/review/ReviewScreen.tsx: ReviewScreen({onClose, onCountChange})`.
- `features/hotkeys/HotkeyOverlay.tsx: HotkeyOverlay()` — оверлей по `?`.
- `app/isTypingTarget.ts: isTypingTarget(target): boolean` — общая проверка для всех глобальных хоткеев (включает `SELECT`, не только `INPUT`/`TEXTAREA`).

### Rust: `src-tauri/src/lib.rs` — Tauri-команды (вызываются через `invoke()`)
- `read_file_bytes(path: String) -> Result<Vec<u8>, String>`.
- `write_file_bytes(path: String, contents: Vec<u8>) -> Result<(), String>`.
- `get_db_url(state) -> String`.
- `set_vault_path(path: String) -> Result<(), String>`.
- `get_lock_conflict(state) -> Option<LockInfo>`.
- `resolve_lock_conflict(choice: String, vault, conflict)`.
- `detect_sync_conflicts(state) -> Vec<String>`.
- `make_backup(reason: String, state) -> Result<Option<String>, String>`.
- `list_backups(state) -> Result<Vec<BackupMeta>, String>`.
- `restore_backup(name: String, state) -> Result<(), String>`.
- `log_error(kind, location, detail: Option<String>, state)`.
- `open_logs_folder(app, state) -> Result<(), String>`.
- `pub fn run()` — точка сборки: регистрирует плагины/миграции/команды, запускает окно.

### Rust: вспомогательные модули
- `vault::resolve_vault_path() -> PathBuf`, `vault::db_url_for(path) -> String`, `vault::write_pointer(path)`, `vault::detect_sync_conflicts(path) -> Vec<String>`.
- `lock::check_and_claim(path) -> Option<LockInfo>`, `lock::heartbeat(path)`, `lock::release(path)`, `lock::restore(path, info)`.
- `backup::list_backups(path) -> io::Result<Vec<BackupMeta>>`, `backup::make_backup(path, reason) -> io::Result<Option<String>>`, `backup::restore_backup(path, name) -> io::Result<()>`, `backup::prune_backups(path) -> io::Result<()>`.
- `logging::logs_dir(path) -> PathBuf`, `logging::log_error(path, kind, location, detail: Option<&str>)`.

---

## 5. Потоки данных

**Импорт файла (PDF/HTML):**
```
drag-drop / "Добавить выписку"
  → FilesScreen (читает байты через invoke("read_file_bytes"))
  → import/detectBank → import/peekPeriodStart (сортировка по периоду перед вставкой)
  → import/importStatement
       → parsers/parseXxx (чистый разбор)
       → parsers/checkGolden (итоги файла vs распарсенное — иначе отмена импорта)
       → parsers/assignDedupKeys
       → db/statements.insertStatement + db/transactions.insertTransaction (через DbClient)
  → review/buildReviewCandidates (кандидаты в переводы/возвраты)
  → import/mergeManualCandidates (это та же операция, что ручная запись?)
  → import/applyGoalRulesToTransactions
  → UI обновляет список через повторный listStatements/queryTransactions
```

**Аналитика/дашборд:**
```
db/ledgerQuery.queryLedger (сырые строки из БД)
  → ledger/computeLedger (включение/исключение + причина)
  → analytics/selectPeriodRows (период + фильтры)
  → analytics/grouping | analytics/timeSeries | analytics/metrics
  → features/dashboard/widgetRegistry.renderWidget (виджет читает уже готовый срез)
  → features/analytics/EChart (рисует через echarts)
```

**Command palette (Ctrl+K):**
```
каждый смонтированный экран → useRegisterCommands(groupId, commands)
  → CommandContext хранит Map<groupId, commands[]>
  → useAllCommands() на палитре — плоский список
  → commandPalette/searchPalette фильтрует по вводу
```

**Undo (Ctrl+Z):**
```
перед мутацией → withUndo(stack, label, [{table, whereSql, params}], mutate)
  → снимок затронутых строк (SELECT * WHERE ...)
  → выполняет mutate()
  → UndoStack.undo() восстанавливает снимок тем же DbClient.execute
```

**Границы Tauri (frontend ↔ Rust):**
```
src/*.ts  --invoke("имя_команды", {...})-->  #[tauri::command] в lib.rs
                                                 │
                                    VaultState / LockConflict (управляемое состояние)
                                                 │
                                    vault.rs / lock.rs / backup.rs / logging.rs
```
Все обращения к SQLite с фронтенда идут НЕ через свои Tauri-команды, а через
`@tauri-apps/plugin-sql`'s `Database.load(dbUrl)` → `.select()`/`.execute()`
(обёрнуто в `db/client.ts: getDb()`), которое само говорит с Rust-плагином
`tauri-plugin-sql`/sqlx по отдельному внутреннему каналу.

**Единственный сетевой вызов (цены KASE):**
```
features/investments/UpdatePricesButton
  → investments/kasePriceSource.buildKaseHistoryUrl
  → @tauri-apps/plugin-http fetch (НЕ webview fetch — иначе упёрлись бы в CORS)
  → доменный allowlist в capabilities/default.json ("https://kase.kz/*")
  → kasePriceSource.parseKaseHistoryResponse
  → db/securityPrices.upsertPrices
```

---

## 6. Конфигурация

| Файл | Что в нём |
|---|---|
| `vite.config.ts` | React-плагин, фиксированный порт 1420 (strictPort — иначе Tauri не найдёт dev-сервер), игнорирует `src-tauri` в watch. |
| `src-tauri/tauri.conf.json` | productName/identifier, `beforeDevCommand: npm run dev`, `devUrl: http://localhost:1420`, `beforeBuildCommand: npm run build`, `frontendDist: ../dist`, размер окна 1100×700, CSP отключён (`null`), иконки бандла. |
| `src-tauri/capabilities/default.json` | permissions: `sql:default`+`sql:allow-execute`, `dialog:default`, `opener:default`, `http:default` с allow-листом **только** `https://kase.kz/*`. |
| `src-tauri/Cargo.toml` | крейты (раздел 1) + `[profile.release]`: `lto=true, codegen-units=1, opt-level=3, panic="abort", strip=true` — минимизация размера бинарника. |
| `src-tauri/src/lib.rs` | регистрация миграций 0001–0010 по порядку (`Migration{version, description, sql: include_str!(...), kind: MigrationKind::Up}`), регистрация плагинов, `invoke_handler`. |
| `package.json` → `scripts` | `dev` (`vite`), `build` (`tsc && vite build`), `preview`, `tauri` (`tauri` CLI), `test` (`vitest run`), `test:e2e` (`wdio run e2e/wdio.conf.mjs`). |

**Команды сборки/запуска:**
```bash
npm install                         # ставит JS-зависимости
npm run tauri dev                   # dev-режим: vite + cargo run, открывает окно
npm run build                       # tsc --noEmit-эквивалент (через build) + vite build → dist/
npx tsc --noEmit                    # только проверка типов
npx vitest run                      # юнит-тесты фронтенда
cargo check --manifest-path src-tauri/Cargo.toml   # проверка Rust-стороны
npm run tauri build                 # финальный офлайн-бандл (использует [profile.release])
npx wdio run e2e/wdio.conf.mjs      # e2e smoke-тест (нужен собранный бандл)
```

---

## 7. Документация для офлайна

| Технология | Что конкретно понадобится | Как получить офлайн |
|---|---|---|
| Rust std + все крейты из `Cargo.lock` (tauri, sqlx, serde, chrono, dirs, gethostname, tauri-plugin-*) | API конкретных версий, зафиксированных в `Cargo.lock` | `cargo doc --no-deps --open` в `src-tauri/` — генерирует полную HTML-документацию для каждой закэшированной в `~/.cargo` версии крейта; работает полностью офлайн после `cargo fetch`/первой онлайн-сборки. |
| Tauri 2 (концепции: команды, capabilities, plugins, state, mobile) | `tauri::command`, `tauri::State`, `Builder::manage/plugin/invoke_handler`, формат `capabilities/*.json`, `tauri.conf.json` схема | Tauri Book — mdbook, качается `git clone` репозитория `tauri-apps/tauri` и собирается локально (`mdbook build`), либо держать уже клонированный репозиторий как offline-справочник. |
| sqlx / SQLite SQL | синтаксис миграций, типы столбцов, `PRAGMA`, поведение `$N`-плейсхолдеров (sqlx биндит их **позиционно по каждому упоминанию**, не по индексу — частый источник багов в этом проекте) | `man sqlite3`; офлайн HTML-документация SQLite скачивается один раз как zip с sqlite.org (`sqlite-doc-*.zip`) и распаковывается локально; `cargo doc` для sqlx-core/sqlx-sqlite покрывает Rust-API. |
| React 19 / JSX / Hooks | `useEffect` deps-массив и его взаимодействие с Context (см. баг с `useRegisterCommands`), `useMemo`/`useCallback`, `React.lazy`+`Suspense` | DevDocs.io имеет офлайн-режим (Service Worker кэширует весь доксет при одном онлайн-визите) — доксет "React"; либо Zeal/Dash с доксетом React. |
| TypeScript 6 | generics, discriminated unions (`ParsedTransaction`, `ImportResult`), `satisfies`, utility types (`Partial`/`Omit`, использованные в `GoalPatch`) | DevDocs.io доксет "TypeScript"; `tsc --help` и встроенный `// @ts-check` используют один и тот же компилятор — ничего скачивать не нужно, если TS уже установлен (`npx tsc --version`). |
| DOM API: drag-and-drop, `ResizeObserver`, `localStorage`, `history.pushState`/`popstate` | `DataTransfer` (НЕ используется напрямую — см. ниже про Tauri drag-drop), `window.addEventListener("keydown"|"popstate")`, `Element.scrollIntoView` | DevDocs.io доксет "DOM"/"HTML" (зеркало MDN); можно скачать офлайн MDN-дамп через `mdn/content` репозиторий, но DevDocs проще. |
| Tauri `@tauri-apps/api` JS-биндинги | `invoke()`, `getCurrentWebview().onDragDropEvent()` (НЕ HTML5 `DataTransfer.files` — в webkit2gtk он не даёт настоящих путей), `@tauri-apps/plugin-dialog`'s `open()` | `.d.ts`-файлы в `node_modules/@tauri-apps/*/dist/` после `npm install` — полный типизированный API, читается редактором (hover/go-to-definition) без интернета; у Tauri Book есть отдельный JS API раздел, который так же можно клонировать. |
| ECharts (`option` schema) | `xAxis`/`yAxis`/`series` (line/bar/pie), `tooltip`, `dataZoom`, `grid` — конкретно то, что использует `chartOptions.ts`/`portfolioChartOptions.ts`/`stockChartOption.ts`/`goalPlanChartOption.ts` | ECharts поставляет офлайн-экспортируемый конфигуратор опций на `echarts.apache.org/en/option.html`, который можно сохранить как статический HTML (`wget --mirror` один раз); либо `node_modules/echarts/types/dist/echarts.d.ts` как типизированный референс. |
| `react-grid-layout` | `<ReactGridLayout>` пропсы (`layout`, `cols`, `rowHeight`, `margin`, `draggableHandle`, `onDragStop`/`onResizeStop`), `WidthProvider` HOC | README в `node_modules/react-grid-layout/README.md` + `.d.ts` в том же пакете — единственный практический офлайн-референс для этой небольшой библиотеки. |
| `@tanstack/react-virtual` | `useVirtualizer({count, getScrollElement, estimateSize})`, `virtualizer.getTotalSize()`/`getVirtualItems()`/`scrollToIndex()` — важно: виртуализатор **не** авто-скроллит к программно изменённому активному индексу, нужен явный `scrollToIndex` в `useEffect` | `node_modules/@tanstack/react-virtual/README.md` + `.d.ts`; сайт `tanstack.com/virtual` зеркалится тем же README. |
| pdf.js (`pdfjs-dist`) | `getDocument()`, `page.getTextContent()` (координаты `item.transform` для `pdfRows.ts`), воркер (`GlobalWorkerOptions.workerSrc`) | `node_modules/pdfjs-dist/types/src/pdf.d.ts`; офлайн-примеры лежат прямо в пакете (`node_modules/pdfjs-dist/examples/` в части версий). |
| webdriverio / e2e | конфиг `wdio.conf.mjs`, Mocha-синтаксис тестов | `node_modules/webdriverio/README.md` + типы; DevDocs не покрывает wdio — пакетные `.d.ts`/README остаются единственным офлайн-источником. |

---

## 8. Порядок сборки

- [ ] **Схема БД.** Спроектировать и написать миграции 0001–0010 (счета,
      категории, транзакции, сплиты, переводы → правила категорий → статус
      переводов → ручные транзакции → леджер-поля → повторяющиеся серии →
      пресеты дашборда → долги → инвестиции → цели), зарегистрировать их в
      `lib.rs` по порядку.
- [ ] **Rust-оболочка.** `vault.rs` (путь к базе) → `lock.rs` (файл-блокировка)
      → `backup.rs` → `logging.rs` → `lib.rs` (команды + Tauri Builder),
      убедиться, что `cargo check` зелёный и окно открывается с пустой базой.
- [ ] **Слой `db/*`.** CRUD-функции под уже созданную схему, с самого начала
      через узкий интерфейс `DbClient` (чтобы тесты шли через node:sqlite-фейк,
      а не настоящий Tauri). Покрыть юнит-тестами сразу.
- [ ] **Парсинг.** `parsers/pdfRows.ts` (общий слой извлечения текста) →
      по одному парсеру на банк → `dedup.ts`/`goldenCheck.ts`.
- [ ] **Импорт.** `import/detectBank` → `import/importStatement` (собирает
      parsers+db вместе) → UI для drag-drop/выбора файла.
- [ ] **Базовый UI-каркас.** `App.tsx`, `TabBar`, темизация (`theme.ts/css`),
      провайдеры (`ReadOnlyProvider`, `UndoProvider`, `CommandProvider`) —
      даже без контента вкладок, чтобы было куда вставлять экраны.
- [ ] **Операции.** `db/transactionsQuery` → `OperationsTable` (с
      виртуализацией) → категории/правила/сплиты → bulk-действия → хоткеи.
- [ ] **Леджер + аналитика.** `ledger/computeLedger` → `analytics/*` чистые
      функции → `AnalyticsScreen` с графиками (`EChart` только из
      lazy-точки входа, чтобы не раздувать основной бандл).
- [ ] **Дашборд.** `dashboard/presetConfig` → `DashboardScreen` с
      `react-grid-layout` → виджеты (`widgetRegistry`).
- [ ] **Долги.** `debts/*` чистая логика → `db/debts.ts` → `DebtsScreen` +
      диалоги.
- [ ] **Инвестиции.** `investments/PriceSource` интерфейс →
      `kasePriceSource` (первый сетевой вызов, сразу с доменным allowlist в
      `capabilities/default.json`) → `estimateQuantity`/`fifo`/
      `computePositions` → `InvestmentsScreen`.
- [ ] **Цели.** `goals/*` чистая логика → `db/goals*.ts` → `GoalsScreen` +
      диалоги.
- [ ] **Объединение экранов.** Три `*HubScreen` (Файлы+Настройки+Данные,
      Категории+Операции, Аналитика+Инвестиции) — после того как все
      входящие экраны уже самостоятельно работают.
- [ ] **Полировка.** Темы (amoled/dim/slate), command palette, hotkey-оверлей,
      надёжность (бэкапы/блокировка/read-only режим), undo-стек везде, где
      нужен.
- [ ] **Релиз.** `npm run tauri build` на десктоп, Android-таргет
      (`src-tauri/gen/android`), e2e smoke-тест.
