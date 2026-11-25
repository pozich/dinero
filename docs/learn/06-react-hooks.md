# 06. Хуки: useEffect, useMemo/useCallback, useRef, useContext — и реальный баг

Хуки — функции `useXxx`, которые можно вызывать только на верхнем
уровне компонента (не внутри `if`, не внутри цикла, не внутри вложенной
обычной функции) и только в одном и том же порядке при каждом рендере
— React запоминает их "по порядку вызова", а не по имени.

## `useEffect` — код, который выполняется ПОСЛЕ отрисовки

```tsx
useEffect(() => {
  console.log("компонент отрисовался");
}, []);
```

Это не часть JSX — это побочный эффект (запрос к серверу, подписка на
событие, таймер), выполняемый React-ом уже после того, как компонент
попал на экран. Второй аргумент — **массив зависимостей**:
- `[]` (пустой массив) — выполнить один раз, при первом появлении
  компонента.
- `[a, b]` — выполнить при первом появлении, а дальше — повторно
  каждый раз, когда `a` ИЛИ `b` изменились с прошлого рендера.
- без массива вообще — выполнять при КАЖДОМ рендере (на практике
  почти никогда не нужно).

### Функция очистки (cleanup)

```tsx
useEffect(() => {
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, []);
```

Если из функции эффекта вернуть функцию — React вызовет её перед
следующим запуском эффекта (если зависимости изменились) и при
размонтировании компонента. Для подписок (слушатели событий,
таймеры, соединения) это единственный правильный способ не оставлять
"висящие" подписки после того, как компонент исчез с экрана.

## `useMemo`/`useCallback` — зачем нужна «стабильность по ссылке»

Ключевая вещь, которую нужно понять: в JS два объекта с ОДИНАКОВЫМ
содержимым — это два РАЗНЫХ значения:

```ts
const a = { x: 1 };
const b = { x: 1 };
console.log(a === b); // false — разные объекты в памяти, хоть и одинаковые по содержимому
```

При каждом рендере компонента ВСЕ объекты/массивы/функции, созданные
прямо в теле компонента, пересоздаются заново — даже если их
содержимое не изменилось. Если такой объект попал в массив
зависимостей `useEffect` у ДРУГОГО кода, React увидит "новую" ссылку и
решит, что зависимость изменилась — хотя по смыслу ничего не
поменялось.

`useMemo` запоминает ЗНАЧЕНИЕ между рендерами, пока зависимости не
изменились:

```tsx
const sorted = useMemo(() => [...items].sort(), [items]);
```

`[...items].sort()` не будет пересчитываться на каждый рендер — только
когда `items` реально изменился (новая ссылка на массив).

`useCallback` — то же самое, но для ФУНКЦИИ (по сути `useCallback(fn, deps)`
равносильно `useMemo(() => fn, deps)`):

```tsx
const register = useCallback((groupId, commands) => {
  /* ... */
}, []);
```

С пустым массивом зависимостей — функция `register` будет буквально
ОДНОЙ И ТОЙ ЖЕ ссылкой во всех рендерах этого компонента, сколько бы
раз он ни перерисовывался.

## `useRef` — ящик, который не вызывает перерисовку

```tsx
const containerRef = useRef<HTMLDivElement>(null);
// ...
<div ref={containerRef}>...</div>
```

`useRef` тоже хранит значение между рендерами (как `useState`), но
изменение `.current` **не** просит React перерисовать компонент. Для
DOM-узлов (как здесь) React сам заполняет `.current` реальным
DOM-элементом после отрисовки — отсюда реальный пример:

```ts
// src/features/files/FilesHubScreen.tsx
containerRef.current
  ?.querySelector(`#hub-section-${id}`)
  ?.scrollIntoView({ behavior: "smooth", block: "start" });
```

## `useContext` — передать данные вглубь дерева без пробрасывания props

Если бы данные нужно было передать через 5 уровней вложенных
компонентов, пришлось бы пробрасывать props через каждый уровень
(`props drilling`). `Context` — способ "положить" значение один раз
наверху и прочитать его в любом компоненте внутри, без
промежуточных props:

```tsx
const ThemeContext = createContext("dim");

function App() {
  return (
    <ThemeContext.Provider value="amoled">
      <DeepChild />
    </ThemeContext.Provider>
  );
}

function DeepChild() {
  const theme = useContext(ThemeContext); // "amoled", без единого промежуточного props
  return <p>{theme}</p>;
}
```

**Ключевое правило, которое дальше ломается в реальном баге**: каждый
компонент, читающий `useContext(SomeContext)`, перерисовывается КАЖДЫЙ
РАЗ, когда `Provider` получает новое значение `value` (новую ссылку) —
даже если фактическое содержимое не изменилось.

## Реальный баг: бесконечный цикл ре-рендера

В этом проекте есть палитра команд (Ctrl+K) — каждый экран сам
регистрирует список своих команд через хук `useRegisterCommands`.
Вот упрощённая версия того, как это было ДО исправления:

```tsx
// src/features/commandPalette/CommandContext.tsx — БЫЛО (баг)
export function useRegisterCommands(groupId: string, commands: PaletteCommand[]): void {
  const ctx = useContext(CommandContext);
  useEffect(() => {
    ctx?.register(groupId, commands);
    return () => ctx?.unregister(groupId);
  }, [ctx, groupId, commands]); // <-- вот здесь проблема
}
```

А вот `Provider`, который хранит сам реестр команд:

```tsx
// src/features/commandPalette/CommandContext.tsx (действующий код)
export function CommandProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Registry>(new Map());

  const register = useCallback((groupId: string, commands: PaletteCommand[]) => {
    setRegistry((prev) => {
      const next = new Map(prev);   // ВСЕГДА новый объект Map
      next.set(groupId, commands);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ registry, register, unregister }), [registry, register, unregister]);

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}
```

Смотри внимательно на цепочку причин:

1. Экран монтируется → эффект в `useRegisterCommands` вызывает
   `ctx.register(...)`.
2. `register` вызывает `setRegistry` с **новым объектом** `Map`
   (`new Map(prev)` — всегда новая ссылка, даже если набор команд
   внутри не изменился по смыслу).
3. `registry` в `CommandProvider` изменился (новая ссылка) → `useMemo`
   для `value` пересчитался → `value` — тоже новая ссылка.
4. Любой компонент, читающий `useContext(CommandContext)` (в том числе
   тот же самый экран, который только что вызвал `register`), получает
   НОВЫЙ `ctx` и перерисовывается.
5. В массиве зависимостей эффекта было `[ctx, groupId, commands]`. `ctx`
   — новая ссылка (шаг 4) → React решает, что зависимость изменилась →
   запускает cleanup (`unregister`) и затем сам эффект заново
   (`register`) — **возвращаясь к шагу 2**.

Получается цикл без выхода: регистрация меняет `ctx`, изменение `ctx`
запускает перерегистрацию, перерегистрация снова меняет `ctx`... React
в итоге обрывает это сам, с ошибкой `"Maximum update depth exceeded"`
— но пока цикл крутится, вкладка фактически не отвечает на клики,
потому что процессор занят бесконечными перерисовками.

Это два экрана, зарегистрировавших команды одновременно (раньше на
экране было смонтировано только ОДНО такое дерево за раз — переключение
вкладок размонтировало предыдущее; когда несколько экранов "Файлы",
"Настройки", "Данные" стали одной вкладкой одновременно, цикл стало
видно сразу при старте).

### Исправление

```tsx
// src/features/commandPalette/CommandContext.tsx — СТАЛО (исправлено)
export function useRegisterCommands(groupId: string, commands: PaletteCommand[]): void {
  const ctx = useContext(CommandContext);
  const register = ctx?.register;     // стабильная ссылка (useCallback, deps: [])
  const unregister = ctx?.unregister; // стабильная ссылка
  useEffect(() => {
    register?.(groupId, commands);
    return () => unregister?.(groupId);
  }, [register, unregister, groupId, commands]); // ctx объекта тут больше нет
}
```

`register`/`unregister` — САМИ функции стабильны между рендерами
(`useCallback(..., [])` в `CommandProvider` гарантирует это), в отличие
от объекта `ctx`, который их просто "упаковывает" вместе с
постоянно меняющимся `registry`. Зависимость теперь — от стабильных
функций, а не от объекта, который сам пересобирается как побочный
эффект работы этого самого хука. Цикл разорван: регистрация меняет
`registry`/`ctx`, но эффект это больше не замечает, потому что
`register`/`unregister` (то, от чего он реально зависит) не менялись.

## Итог главы

Правило для памяти: **в массив зависимостей `useEffect`/`useMemo`/
`useCallback` кладётся только то, что реально должно вызывать повтор**
— а не "всё, что используется внутри", если часть этого "всего" —
нестабильный объект-обёртка, который сам меняется как следствие того
же эффекта. В следующей главе — SQL и настоящий баг того же калибра,
но на стороне базы данных.
