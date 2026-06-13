import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ProfileView from "./ProfileView.jsx";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";

/* /u/:username — a user's PUBLIC arcade. Resolves username → uid → the public
   profiles/{uid} doc, then renders the shared ProfileView (public flavor).
   Private state (8-ball legends, streak) never appears here; that stays on the
   owner's own /me. */

// Lazy, guarded cloud import (browser-only seam).
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null;
  if (!cloudPromise) cloudPromise = import("../lib/cloud.js").catch(() => null);
  return cloudPromise;
}

export default function ProfilePage() {
  const { username } = useParams();
  const [state, setState] = useState({ status: "loading", profile: null, uid: null });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", profile: null, uid: null });
    (async () => {
      const c = await cloud();
      if (!c) {
        if (alive) setState({ status: "error", profile: null, uid: null });
        return;
      }
      const uid = await c.resolveUsername(username).catch(() => null);
      if (!uid) {
        if (alive) setState({ status: "notfound", profile: null, uid: null });
        return;
      }
      const profile = await c.readProfile(uid).catch(() => null);
      if (alive) setState({ status: profile ? "ok" : "notfound", profile, uid });
    })();
    return () => {
      alive = false;
    };
  }, [username]);

  const Shell = (inner) => (
    <div className="arcade-stage">
      <BackBar />
      <div className="arcade-profile">{inner}</div>
    </div>
  );

  if (state.status === "loading") return Shell(<p className="arcade-profile-empty">loading profile…</p>);
  if (state.status !== "ok" || !state.profile) {
    return Shell(
      <div className="arcade-notfound">
        <NedryGag message={`No arcade for "${username}".`} />
        <Link to="/" className="arcade-back-link">← Back to Ourcade</Link>
      </div>
    );
  }

  return Shell(
    <ProfileView profile={state.profile} uid={state.uid} username={username} owner={false} />
  );
}
