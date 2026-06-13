/* ─────────────────────────────────────────────────────────────────────────
   AUTH — anonymous-first identity for Ourcade.

   On load every visitor silently gets a Firebase ANONYMOUS account, so their
   streaks / votes / collections start syncing immediately (no login wall —
   matches the no-pressure old-web vibe). "Claiming" an account links a
   username + email/password onto that same anonymous uid (linkWithCredential),
   so nothing they earned is lost. Returning users log in with email/password.

   The Firebase SDK (~200KB) is LAZY-loaded via dynamic import (loadFb) so it
   never bloats the entry bundle or blocks first paint — components render from
   the localStorage cache while auth + the SDK warm up a beat later. Browser-only.
   ───────────────────────────────────────────────────────────────────────── */

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_AVATAR, DEFAULT_THEME } from "../data/profilePresets.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Once-per-session guard so the lazy number backfill (loadProfile) fires at
// most once even across re-auths / profile reloads.
let numberBackfilled = false;

// Load Firebase app + auth + firestore once, as one async chunk (shared with
// cloud.js via the same ./firebase.js module).
let fbPromise = null;
function loadFb() {
  if (!fbPromise) {
    fbPromise = Promise.all([
      import("./firebase.js"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]).then(([core, fbAuth, fbStore]) => ({ ...core, ...fbAuth, ...fbStore }));
  }
  return fbPromise;
}

// Reserve a username (race-safe), stamp the private profile, and seed the
// PUBLIC profiles/{uid} doc (avatar/theme/bio/favorites) so /u/:username works
// the moment an account is claimed. Local favorites earned as a guest are
// carried up into the new public profile.
async function claimUsername(m, uname, forUid, seedFavorites, seedRelicCount) {
  const uid = forUid || m.auth.currentUser?.uid;
  const name = uname.trim();
  const key = name.toLowerCase();
  await m.runTransaction(m.db, async (tx) => {
    const ref = m.doc(m.db, "usernames", key);
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data().uid !== uid) throw new Error("That username is taken.");
    tx.set(ref, { uid, username: name });
    tx.set(
      m.doc(m.db, "users", uid),
      { username: name, email: m.auth.currentUser?.email || null, createdAt: m.serverTimestamp() },
      { merge: true }
    );
    tx.set(
      m.doc(m.db, "profiles", uid),
      {
        username: name,
        avatar: DEFAULT_AVATAR,
        theme: DEFAULT_THEME,
        bio: "",
        favorites: Array.isArray(seedFavorites) ? seedFavorites : [],
        relicCount: Number(seedRelicCount) || 0,
        createdAt: m.serverTimestamp(),
        updatedAt: m.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);
  const [profile, setProfile] = useState(null); // PUBLIC profiles/{uid} doc
  const [ready, setReady] = useState(false);

  // Pull the public profile for a named user, reconciling favorites with what
  // was earned locally (union), and mirror that union into the local store so
  // the ⭐ on the home cabinets reflects the account immediately.
  async function loadProfile(m, uid) {
    try {
      const snap = await m.getDoc(m.doc(m.db, "profiles", uid));
      const prof = snap.exists() ? snap.data() : null;
      const store = await import("./store.js").catch(() => null);
      const localFavs = store ? store.getFavorites() : [];
      const cloudFavs = Array.isArray(prof?.favorites) ? prof.favorites : [];
      const merged = Array.from(new Set([...cloudFavs, ...localFavs]));
      if (store) store.setFavoritesLocal(merged);
      const next = { ...(prof || {}), favorites: merged };
      setProfile(next);
      // If local had favorites the cloud was missing, push the union up once.
      if (prof && merged.length !== cloudFavs.length) {
        const c = await import("./cloud.js").catch(() => null);
        c?.writeProfile?.({ favorites: merged }).catch(() => {});
      }
      // Lazy phone-number backfill: pre-M2 accounts (claimed before the Nopia
      // phone shipped) have no number yet — mint one, once per session, and
      // patch it into local profile state so /me shows it without a reload.
      if (prof && !prof.number && !numberBackfilled) {
        numberBackfilled = true;
        import("./cloud.js")
          .then((c) => c.allocateNumber())
          .then((num) => num && setProfile((p) => ({ ...(p || {}), number: num })))
          .catch(() => {});
      }
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    let unsub = () => {};
    loadFb()
      .then((m) => {
        unsub = m.onAuthStateChanged(m.auth, async (u) => {
          if (!u) {
            try {
              await m.signInAnonymously(m.auth); // fires this listener again
            } catch {
              setReady(true); // anon disabled / offline → local-only
            }
            return;
          }
          setUser(u);
          setReady(true);
          import("./store.js").then((s) => s.hydrateFromCloud(u.uid)).catch(() => {});
          if (u.isAnonymous) {
            setUsername(null);
            setProfile(null);
          } else {
            try {
              const snap = await m.getDoc(m.doc(m.db, "users", u.uid));
              setUsername(snap.exists() ? snap.data().username || null : null);
            } catch {
              setUsername(null);
            }
            loadProfile(m, u.uid);
          }
        });
      })
      .catch(() => setReady(true)); // SDK failed to load → degrade gracefully
    return () => unsub();
  }, []);

  // Merge a patch into the public profile (optimistic local update + cloud).
  async function updateProfile(patch) {
    if (!patch) return;
    setProfile((p) => ({ ...(p || {}), ...patch }));
    const c = await import("./cloud.js").catch(() => null);
    await c?.writeProfile?.(patch);
  }

  // Claim the current anonymous account (or make a fresh one) with credentials.
  async function signUp(usernameInput, email, password) {
    const name = (usernameInput || "").trim();
    if (!USERNAME_RE.test(name)) {
      throw new Error("Username must be 3–20 letters, numbers, or underscores.");
    }
    const m = await loadFb();
    const existing = await m.getDoc(m.doc(m.db, "usernames", name.toLowerCase()));
    if (existing.exists()) throw new Error("That username is taken — try another.");

    const cur = m.auth.currentUser;
    const cred = m.EmailAuthProvider.credential(email, password);
    const res =
      cur && cur.isAnonymous
        ? await m.linkWithCredential(cur, cred) // keeps uid + all synced data
        : await m.createUserWithEmailAndPassword(m.auth, email, password);
    // Carry guest-earned favorites + discovered relic count into the new
    // public profile.
    let seedFavs = [];
    let seedRelics = 0;
    try {
      const store = await import("./store.js");
      seedFavs = store.getFavorites();
      seedRelics = store.getDiscoveredLegendaries().length;
    } catch {
      /* no store / private mode */
    }
    await claimUsername(m, name, res.user.uid, seedFavs, seedRelics);
    // Mint this account's permanent Ourcade number. A SEPARATE transaction from
    // the username claim so the hot global counter never sits on that critical
    // path — and a failure here is fine (loadProfile backfills next load).
    let number = null;
    try {
      const c = await import("./cloud.js");
      number = await c.allocateNumber();
    } catch {
      /* no number yet — backfilled on next load */
    }
    numberBackfilled = true; // we just (tried to) allocate; don't double up
    setUser(res.user);
    setUsername(name);
    setProfile({
      username: name,
      avatar: DEFAULT_AVATAR,
      theme: DEFAULT_THEME,
      bio: "",
      favorites: seedFavs,
      relicCount: seedRelics,
      number,
    });
    return res.user;
  }

  const value = {
    user,
    uid: user?.uid || null,
    isAnonymous: user?.isAnonymous ?? true,
    username,
    profile,
    updateProfile,
    ready,
    signUp,
    signIn: async (email, password) => {
      const m = await loadFb();
      return m.signInWithEmailAndPassword(m.auth, email, password);
    },
    signOut: async () => {
      const m = await loadFb();
      return m.signOut(m.auth);
    },
    resetPassword: async (email) => {
      const m = await loadFb();
      return m.sendPasswordResetEmail(m.auth, email);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
