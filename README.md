# Dinero

Локальный учёт личных финансов по банковским выпискам. См. `SPEC.md`.

## Разработка (Linux)

Нужны: Node.js + npm, Rust + Cargo, системные зависимости Tauri
(`webkit2gtk`, `libayatana-appindicator3` и т.п. — см.
[Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev
```

При первом запуске создаётся файл `dinero.db` в каталоге данных приложения,
на него накатываются миграции из `src-tauri/migrations/`.

## Тесты

```bash
npm test
```

Бизнес-логика (парсеры выписок, дедупликация, связывание переводов)
тестируется начиная с Э2 — пока в `tests/` только проверка, что раннер
настроен.

## Сборка под Windows / Android

Будет описано в Э7.
