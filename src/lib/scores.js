/* ─────────────────────────────────────────────────────────────────────────
   SCORES — the React side of the Arcade Score Standard.

   ONE contract for every cabinet: a game opts in by adding a `score` config to
   its registry entry (src/data/games.js), and it automatically gets a board.
   Two hooks cover the whole surface:

     useArcadeScore(gameId) → { submit, best }   — submit a run, read your best
     useLeaderboard(gameId, n) → { entries, loading }  — live top-N

   Boards are CLAIMED-ACCOUNTS-ONLY: submit() no-ops for anonymous users (their
   pre-claim runs simply aren't ranked; once they claim, the same uid starts
   landing on boards). Identity (username/avatar) comes from AuthProvider's
   public `profile`. All Firestore access goes through the browser-only
   cloud.js dynamic import — same seam store.js uses — so nothing here drags
   Firebase into Node.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthProvider.jsx";
import { getGame } from "../data/games.js";
import { lsGet, lsSet } from "./store.js";

// Lazy, guarded cloud import (mirrors store.js's cloud() seam).
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null;
  if (!cloudPromise) cloudPromise = import("./cloud.js").catch(() => null);
  return cloudPromise;
}

// Per-game scoring direction from the registry ("desc" = higher better).
function dirFor(gameId) {
  return getGame(gameId)?.score?.dir === "asc" ? "asc" : "desc";
}
// Is `a` a better score than `b` for this game's direction? (b may be null.)
function isBetter(gameId, a, b) {
  if (b == null) return true;
  return dirFor(gameId) === "asc" ? a < b : a > b;
}

// Instant-UI cache of the player's own best, so the game-over screen and board
// don't wait on a network round-trip. Keyed per game. Stored via the shared
// ourcade:-prefixed localStorage util (lsGet adds the prefix), so the physical
// key stays `ourcade:best:<gameId>` exactly as before.
const BEST_KEY = (gameId) => `best:${gameId}`;
function readLocalBest(gameId) {
  const raw = lsGet(BEST_KEY(gameId));
  return raw == null ? null : Number(raw);
}
function writeLocalBest(gameId, score) {
  lsSet(BEST_KEY(gameId), score);
}

// Submit a run + read your best for one game.
export function useArcadeScore(gameId) {
  const auth = useAuth() || {};
  const { uid, isAnonymous, username, profile } = auth;
  const [best, setBest] = useState(() => (gameId ? readLocalBest(gameId) : null));

  // Re-seed from the local cache whenever the game changes. The useState
  // initializer only runs on mount, so without this a component reused across
  // gameIds (e.g. HighScoreBoard hopping between /scores/:id boards) would keep
  // showing the previous game's best for anonymous users, whose cloud reconcile
  // below early-returns.
  useEffect(() => {
    setBest(gameId ? readLocalBest(gameId) : null);
  }, [gameId]);

  // Reconcile the cached best with the cloud once we know who we are.
  useEffect(() => {
    if (!gameId || !uid || isAnonymous) return;
    let alive = true;
    const p = cloud();
    if (!p) return;
    p.then((c) => c && c.readScore(gameId))
      .then((entry) => {
        if (!alive || !entry || typeof entry.score !== "number") return;
        if (isBetter(gameId, entry.score, readLocalBest(gameId))) {
          writeLocalBest(gameId, entry.score);
          setBest(entry.score);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [gameId, uid, isAnonymous]);

  const submit = useCallback(
    (score) => {
      if (!gameId || typeof score !== "number" || Number.isNaN(score)) return;
      // Always keep the local best fresh (used by the game-over screen).
      if (isBetter(gameId, score, readLocalBest(gameId))) {
        writeLocalBest(gameId, score);
        setBest(score);
      }
      // Claimed accounts only: anon runs aren't ranked.
      if (!uid || isAnonymous || !username) return;
      const p = cloud();
      if (!p) return;
      p.then(async (c) => {
        if (!c) return;
        // Only write when this beats our stored entry — the rules forbid a
        // decrease, so a worse run is just a no-op.
        const cur = await c.readScore(gameId).catch(() => null);
        if (cur && typeof cur.score === "number" && !isBetter(gameId, score, cur.score)) return;
        await c.writeScore(gameId, {
          username,
          avatar: profile?.avatar || null,
          score,
        });
      }).catch(() => {});
    },
    [gameId, uid, isAnonymous, username, profile]
  );

  return { submit, best };
}

// Live top-N for a board. Re-subscribes if game/uid/n change.
export function useLeaderboard(gameId, n = 10) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!gameId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    const p = cloud();
    if (!p) {
      setLoading(false);
      return;
    }
    p.then((c) => {
      if (!alive || !c) {
        setLoading(false);
        return;
      }
      unsubRef.current = c.listenLeaderboard(gameId, dirFor(gameId), n, (rows) => {
        if (!alive) return;
        setEntries(rows);
        setLoading(false);
      });
    }).catch(() => alive && setLoading(false));

    return () => {
      alive = false;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [gameId, n]);

  return { entries, loading };
}
