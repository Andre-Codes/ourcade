import { useCallback, useState } from "react";

/* useQuitConfirm — tiny state helper for guarding a destructive "quit" with a
   confirm dialog. Pair it with <ConfirmDialog>.

   const quit = useQuitConfirm();
   ...
   <button onClick={() => quit.request(() => navigate("/"), { armed: inProgress })}>QUIT</button>
   <ConfirmDialog open={quit.open} title="Quit?" message="Your progress will be lost."
     onConfirm={quit.confirm} onCancel={quit.cancel} />

   `request(action, { armed })` runs `action` immediately when not armed (nothing
   to lose — e.g. on a title/over screen); when armed it stashes the action and
   opens the dialog. `confirm` runs the stashed action; `cancel` discards it. */
export function useQuitConfirm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // the action to run on confirm

  const request = useCallback((action, { armed = true } = {}) => {
    if (!armed) { action?.(); return; }
    setPending(() => action);
    setOpen(true);
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    setPending((action) => { action?.(); return null; });
  }, []);

  const cancel = useCallback(() => {
    setOpen(false);
    setPending(null);
  }, []);

  return { open, request, confirm, cancel };
}
