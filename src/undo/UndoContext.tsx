import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDb } from "../db/client";
import { UndoStack } from "./undoStack";

const UndoStackContext = createContext<UndoStack | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<UndoStack | null>(null);

  useEffect(() => {
    getDb().then((db) => setStack(new UndoStack(db)));
  }, []);

  return <UndoStackContext.Provider value={stack}>{children}</UndoStackContext.Provider>;
}

export function useUndoStack(): UndoStack | null {
  return useContext(UndoStackContext);
}

/** Re-renders the caller whenever the stack changes, so buttons/shortcuts
 * can reflect canUndo/canRedo without polling. */
export function useUndoState(): { stack: UndoStack | null; canUndo: boolean; canRedo: boolean } {
  const stack = useUndoStack();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!stack) return;
    return stack.subscribe(() => setTick((t) => t + 1));
  }, [stack]);

  return {
    stack,
    canUndo: stack?.canUndo() ?? false,
    canRedo: stack?.canRedo() ?? false,
  };
}
