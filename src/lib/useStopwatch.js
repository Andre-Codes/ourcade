import { useEffect, useState } from "react";

/* useStopwatch — whole-seconds elapsed since `startedAt` (epoch ms), ticking
   once a second while `running`. Returns 0 before the clock starts. For a
   FROZEN final time (after a puzzle is solved) don't use this — compute it from
   a stored finishedAt so it can't keep climbing on re-render. */
export function useStopwatch(startedAt, running) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || !startedAt) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, (now - startedAt) / 1000);
}
