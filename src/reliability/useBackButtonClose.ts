import { useEffect } from "react";

/**
 * Android hardware back (and a desktop back gesture/Alt+Left) closes the
 * open dialog instead of leaving the app — SPEC-2.md Ф4 ("системная
 * «назад» закрывает окно... а не выходит из приложения"). Each dialog
 * pushes one history entry while it's open and consumes it again when it
 * closes normally, so back/forward navigation stays consistent either way
 * it closes.
 *
 * Known limitation: if more than one dialog happened to be open at once,
 * a single back press closes all of them (every mounted instance has its
 * own popstate listener) rather than just the topmost — in practice the
 * app's dialogs are opened one at a time, so this hasn't come up, but it's
 * worth knowing if that ever changes. Not verified on a real Android
 * device — see HANDOFF.md.
 */
export function useBackButtonClose(onClose: () => void): void {
  useEffect(() => {
    history.pushState({ dineroModal: true }, "");

    function onPopState() {
      onClose();
    }
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      if (history.state?.dineroModal) {
        history.back();
      }
    };
    // Deliberately empty deps: re-running this on every onClose identity
    // change would push a fresh history entry each time, which is wrong —
    // the effect's job is "one entry for the dialog's whole lifetime".
  }, []);
}
