/** Whether a keydown's target is something the user is actively typing
 * into/picking from — global single-key shortcuts (tab nav, undo, "n" for
 * new entry, etc.) must not fire while it is. SELECT matters just as much
 * as INPUT/TEXTAREA here: a letter key pressed to jump to an option in a
 * focused <select> (or just an arrow key to change it) would otherwise
 * also match a global shortcut and, say, switch tabs out from under the
 * open dropdown. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
