import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FlashChannel from "./FlashChannel.jsx";
import FlashTheater from "./FlashTheater.jsx";
import { findAnimation } from "../data/animations.js";
import BackBar from "./BackBar.jsx";

// Dedicated /flash route. By default it's the lean-back "channel" that
// auto-advances through the whole archive (a TV of old Flash). With ?play=<id>
// (e.g. a flash opened from someone's Top 8) it loads that single animation in
// Ourcade's own flash viewer instead — same in-page player, no jump to archive.org.
export default function FlashPage() {
  const [params] = useSearchParams();
  const playId = params.get("play");
  const [anim, setAnim] = useState(null);
  const [resolving, setResolving] = useState(!!playId);

  useEffect(() => {
    if (!playId) {
      setAnim(null);
      setResolving(false);
      return;
    }
    let alive = true;
    setResolving(true);
    findAnimation(playId).then((a) => {
      if (!alive) return;
      setAnim(a);
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
        {playId ? (
          resolving ? (
            <p className="arcade-channel-loading">loading flash…</p>
          ) : anim ? (
            <FlashTheater initialAnim={anim} browseTo="/flash" />
          ) : (
            <FlashChannel />
          )
        ) : (
          <FlashChannel />
        )}
      </div>
    </div>
  );
}
