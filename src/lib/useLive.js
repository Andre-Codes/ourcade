/* useLive — the React binding for the admin overlay (src/data/live.js).

   Kept out of src/data/ so that module stays node-pure for scripts/daily-check.js.

   Call it once high in the tree (App.jsx does): it kicks the one-time Firestore
   fetch on mount and re-renders when the overlay lands, so the homepage cards
   pick up admin edits without a reload. Cheap to call again anywhere else —
   hydrateLive() is promise-cached and the store is a plain Set of subscribers. */

import { useSyncExternalStore, useEffect } from "react";
import { subscribeLive, liveSnapshot, hydrateLive } from "../data/live.js";

export default function useLive() {
  useEffect(() => {
    hydrateLive();
  }, []);

  // getSnapshot returns the overlay object itself, which setLive() replaces
  // wholesale — so identity comparison is the correct change signal here.
  return useSyncExternalStore(subscribeLive, liveSnapshot, liveSnapshot);
}
