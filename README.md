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

При первом запуске приложение само выбирает папку для данных (по
умолчанию `~/Documents/Dinero` или `~/Dinero`) — это и есть "vault" в духе
Obsidian, его можно поменять на вкладке «Данные» и синхронизировать между
устройствами через Syncthing (подробности и предостережения — SPEC.md,
раздел 2). Путь к выбранной папке хранится в `~/.config/dinero/vault.json`.
Файл `dinero.db` внутри неё создаётся и мигрируется автоматически.

## Тесты

```bash
npm test
```

Бизнес-логика — парсеры всех 4 банков, дедупликация, связывание
переводов, импорт-пайплайн, слой БД — покрыта тестами (часть прогоняется
против реальных sample-файлов из `samples/`, часть — против настоящей
SQLite через `node:sqlite`, не моками).

## Сборка под Windows

Надёжный cross-compile Tauri-приложения с Linux на Windows не завезён
(нужен MSVC-тулчейн). Поэтому сборка идёт через GitHub Actions на
настоящем Windows-раннере: `.github/workflows/windows-build.yml`.

Чтобы собрать:
1. Запушить тег вида `v0.1.0` (`git tag v0.1.0 && git push origin v0.1.0`)
   — или запустить workflow вручную во вкладке Actions репозитория
   (`workflow_dispatch`).
2. Дождаться зелёного билда — он создаст черновик GitHub Release с
   `.msi`/`.exe`-установщиком, прикреплённым к тегу.
3. Скачать установщик со страницы Release, опубликовать релиз (черновик
   специально не публикуется автоматически).

Если нужно собрать локально на настоящей Windows-машине — обычный путь:
поставить Rust + Node + [Tauri Prerequisites для Windows](https://v2.tauri.app/start/prerequisites/#windows),
`npm install`, `npm run tauri build`.

## Сборка Android APK (пошагово, на Arch)

Проверено на этой машине целиком, включая реальную сборку `.apk`.

1. **Поставить SDK/NDK через `sdkmanager`** (не обязательно через GUI
   Android Studio — командной строкой быстрее и воспроизводимее):
   ```bash
   mkdir -p ~/Android/Sdk/cmdline-tools
   curl -L -o /tmp/cmdline-tools.zip \
     https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
   unzip -q /tmp/cmdline-tools.zip -d /tmp/android-cmdline-extract
   mv /tmp/android-cmdline-extract/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
   rm -rf /tmp/android-cmdline-extract /tmp/cmdline-tools.zip

   export ANDROID_HOME="$HOME/Android/Sdk"
   export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

   yes | sdkmanager --licenses
   sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "ndk;27.2.12479018"
   ```
   Это ~2 ГБ на диске (в основном NDK) — проверьте место заранее
   (`df -h ~`).

2. **Переменные окружения** (добавить в `~/.bashrc`/`~/.zshrc`, чтобы не
   прописывать каждый раз):
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
   export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
   ```

3. **Rust-таргеты под Android:**
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

4. **Инициализация** (из корня проекта, разово — создаёт
   `src-tauri/gen/android`, Gradle-проект, он в `.gitignore`):
   ```bash
   npm run tauri android init
   ```

5. **Сборка.** ⚠️ **Собирать сразу под все 4 архитектуры (`--target` не
   указан) — тяжело: на этой машине одна debug-сборка `universal` разом
   разрослась до ~19 ГБ в `target/` и уронила диск в 0 свободного места.**
   Для разработки и проверки на своём телефоне достаточно одной
   архитектуры — у подавляющего большинства Android-телефонов (в т.ч.
   последних лет) это `aarch64`:
   ```bash
   npm run tauri android build -- --debug --target aarch64 --apk
   ```
   APK окажется в
   `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
   (~170 МБ с debug-символами — не бойтесь размера, release заметно
   меньше). Если диск всё же забился —
   `cd src-tauri && cargo clean` безопасно освобождает всё содержимое
   `target/` (пересоберётся заново).

   «Боевой» universal-APK под все архитектуры собирать без `--target` и
   `--debug`, когда действительно нужен релиз и есть ~5 ГБ запаса на
   диске — дальше см. пункт 6 про подпись.

   Для разработки с эмулятором/телефоном по USB — `npm run tauri android dev`.

6. **Подпись релизного APK.** Без ключа подписи release-сборка либо
   откажется собраться, либо соберётся debug-подписанной (не поставится
   поверх существующей установки на телефоне при обновлении). Как
   сгенерировать ключ и подключить — в офиц. доке
   [Tauri: Android code signing](https://v2.tauri.app/distribute/sign/android/).

## Адаптив

Ниже ~768px ширины экрана (или на телефоне) шапка с тремя вкладками
переезжает вниз, под большой палец, и подсказки про горячие клавиши
(A/D, Ctrl+S) скрываются — на сенсорном экране они не нужны, см.
SPEC.md раздел 8.
