import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PaletteCommand = { id: string; label: string; run: () => void };

type Registry = Map<string, PaletteCommand[]>;

const CommandContext = createContext<{
  registry: Registry;
  register: (groupId: string, commands: PaletteCommand[]) => void;
  unregister: (groupId: string) => void;
} | null>(null);

/**
 * Ctrl+K (SPEC-2.md Ф4) needs a flat list of "what can I do right now",
 * but the app only ever has the active tab's screen mounted — so each
 * screen registers its own commands on mount and un-registers on
 * unmount, rather than one static global list. Switching tabs naturally
 * swaps out what the palette can offer, with no extra bookkeeping.
 */
export function CommandProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Registry>(new Map());

  const register = useCallback((groupId: string, commands: PaletteCommand[]) => {
    setRegistry((prev) => {
      const next = new Map(prev);
      next.set(groupId, commands);
      return next;
    });
  }, []);

  const unregister = useCallback((groupId: string) => {
    setRegistry((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Map(prev);
      next.delete(groupId);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ registry, register, unregister }), [registry, register, unregister]);

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

/** Commands passed in must have a stable identity (wrap the array in
 * useMemo at the call site) or this re-registers on every render — still
 * correct, just wasted work.
 *
 * Depend on `register`/`unregister` themselves (stable via useCallback),
 * NOT on the `ctx` object — `ctx` is a new object every time `registry`
 * changes, including as a direct result of THIS effect's own register()
 * call, so depending on it is a feedback loop: register -> registry
 * changes -> ctx changes -> effect re-runs -> register again -> forever.
 * With two or more screens registering commands at once (e.g. the
 * Files+Settings+Data hub) this hits React's "Maximum update depth
 * exceeded" immediately on mount and makes the whole app unresponsive. */
export function useRegisterCommands(groupId: string, commands: PaletteCommand[]): void {
  const ctx = useContext(CommandContext);
  const register = ctx?.register;
  const unregister = ctx?.unregister;
  useEffect(() => {
    register?.(groupId, commands);
    return () => unregister?.(groupId);
  }, [register, unregister, groupId, commands]);
}

export function useAllCommands(): PaletteCommand[] {
  const ctx = useContext(CommandContext);
  return useMemo(() => [...(ctx?.registry.values() ?? [])].flat(), [ctx?.registry]);
}
