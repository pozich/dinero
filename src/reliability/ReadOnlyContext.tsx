import { createContext, useContext, useState, type ReactNode } from "react";

type ReadOnlyState = {
  readOnly: boolean;
  setReadOnly: (value: boolean) => void;
};

const ReadOnlyContext = createContext<ReadOnlyState>({
  readOnly: false,
  setReadOnly: () => {},
});

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const [readOnly, setReadOnly] = useState(false);
  return (
    <ReadOnlyContext.Provider value={{ readOnly, setReadOnly }}>{children}</ReadOnlyContext.Provider>
  );
}

/** Screens check this before entering an editing/mutation flow — when it's
 * true, the lock was held by another device/instance and the user chose
 * "только для чтения" on the conflict dialog (SPEC-2.md 2.1). */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext).readOnly;
}

export function useSetReadOnly(): (value: boolean) => void {
  return useContext(ReadOnlyContext).setReadOnly;
}
