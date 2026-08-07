import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FlashChannel from "./FlashChannel.jsx";
import FlashTheater from "./FlashTheater.jsx";
import { findAnimation } from "../data/animations.js";
import BackBar from "./BackBar.jsx";

// Dedicated /flash route. By default it's the lean-back "channel" that
// auto-advances through the whole archive (a TV of old Flash). With ?play=<id>
// (e.g. a flash opened from someone's Top 8) it loads that single animation in
// Ourcade's own flash viewer instead — same in-page player, no jump to archive.org.
//
// Either player reports the short it lands on and we mirror it into ?play=, so a
// refresh, a bookmark, or a copied address bar all match what's on screen.
export default function FlashPage() {
  const [params, setParams] = useSearchParams();
  const playId = params.get("play");

  // Which player owns the page. STICKY state, not derived from playId: our own
  // address-bar sync changes playId constantly, and deriving from it would flip
  // the running channel into the single-short theater on the first advance.
  const [mode, setMode] = useState(playId ? "theater" : "channel");
  const [anim, setAnim] = useState(null);
  const [resolving, setResolving] = useState(!!playId);
  // Bumped once per REAL navigation, and used as the theater's key. Keying on
  // anim.id instead would miss the case where you arrive at ?play=Y, stumble
  // away to Z, then follow a link back to Y: anim never changes, so the theater
  // wouldn't remount and would keep showing Z.
  const [navSeq, setNavSeq] = useState(0);

  // The id WE last wrote. The resolve effect below ignores it, so a sync is
  // never mistaken for navigation — while a genuinely new ?play= (a Top 8 link
  // clicked while already on /flash, which React Router serves without a
  // remount) still comes through and switches players.
  const selfSet = useRef(null);
  const syncUrl = useCallback(
    (a) => {
      if (!a?.id) return;
      selfSet.current = a.id;
      setParams({ play: a.id }, { replace: true }); // replace → Back leaves the page
    },
    [setParams]
  );

  useEffect(() => {
    if (playId && playId === selfSet.current) return; // our own sync, not navigation
    setNavSeq((n) => n + 1);
    if (!playId) {
      setMode("channel");
      setAnim(null);
      setResolving(false);
      return;
    }
    let alive = true;
    setMode("theater");
    setResolving(true);
    findAnimation(playId).then((a) => {
      if (!alive) return;
      setAnim(a);
      if (!a) setMode("channel"); // unknown id → just roll the channel
      setResolving(false);
    });
    return () => {
      alive = false;
    };
  }, [playId]);

  return (
    <div className="arcade-stage">
      <BackBar />

      <div className="arcade-flash-page">
        {mode === "theater" ? (
          resolving ? (
            <p className="arcade-channel-loading">loading flash…</p>
          ) : (
            // key → a new ?play= arriving while we're already in the theater
            // remounts it, since FlashTheater only reads initialAnim on mount.
            <FlashTheater
              key={navSeq}
              initialAnim={anim}
              browseTo="/flash"
              onAnimChange={syncUrl}
            />
          )
        ) : (
          <FlashChannel onAnimChange={syncUrl} />
        )}
      </div>
    </div>
  );
}
