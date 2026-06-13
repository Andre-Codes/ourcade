import { useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthProvider.jsx";
import { AVATARS, THEMES } from "../data/profilePresets.js";
import { GAMES } from "../data/games.js";
import { getFavorites, toggleFavorite } from "../lib/store.js";
import ProfileView from "./ProfileView.jsx";
import BackBar from "./BackBar.jsx";

// Lazy so the phone's iframe + Firebase listeners only mount when the PHONE tab
// is actually opened (mirrors the lazy-cloud discipline elsewhere).
const NopiaPhone = lazy(() => import("./NopiaPhone.jsx"));

/* /me — claim an account (username + email + password), log in on a new device,
   or manage the signed-in account. Old-internet style: no social logins, just a
   handle and an email for recovery. Claiming LINKS onto the anonymous account,
   so streaks / collections carry over. */

function Field({ label, ...props }) {
  return (
    <label className="arcade-field">
      <span className="arcade-field-label">{label}</span>
      <input className="arcade-field-input" {...props} />
    </label>
  );
}

// Profile editor shown to a named user on /me: avatar, theme, bio, and a
// favorites toggle list. Writes through AuthProvider.updateProfile (public
// profile doc) and store.toggleFavorite (which also syncs favorites up).
function ProfileEditor({ profile, updateProfile }) {
  const avatar = profile?.avatar || AVATARS[0];
  const theme = profile?.theme || THEMES[0].id;
  const [bio, setBio] = useState(profile?.bio || "");
  const [bioSaved, setBioSaved] = useState(false);
  const [favs, setFavs] = useState(() => getFavorites());

  const onToggleFav = (id) => setFavs(toggleFavorite(id));

  return (
    <div className="arcade-editor">
      <div className="arcade-editor-row">
        <span className="arcade-editor-label">avatar</span>
        <div className="arcade-picker">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              className={`arcade-picker-opt${a === avatar ? " is-on" : ""}`}
              onClick={() => updateProfile({ avatar: a })}
              aria-label={`avatar ${a}`}
              aria-pressed={a === avatar}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="arcade-editor-row">
        <span className="arcade-editor-label">theme</span>
        <div className="arcade-picker">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`arcade-picker-swatch${t.id === theme ? " is-on" : ""}`}
              style={{ background: t.color, color: t.color }}
              onClick={() => updateProfile({ theme: t.id })}
              aria-label={`theme ${t.id}`}
              aria-pressed={t.id === theme}
            />
          ))}
        </div>
      </div>

      <div className="arcade-editor-row">
        <span className="arcade-editor-label">bio</span>
        <textarea
          className="arcade-editor-bio"
          value={bio}
          maxLength={160}
          placeholder="say hi — keep it short and 2003."
          onChange={(e) => { setBio(e.target.value); setBioSaved(false); }}
          onBlur={() => { updateProfile({ bio: bio.trim() }); setBioSaved(true); }}
        />
        {bioSaved && <p className="arcade-account-notice">bio saved ✦</p>}
      </div>

      <div className="arcade-editor-row">
        <span className="arcade-editor-label">your arcade (favorites)</span>
        <div className="arcade-fave-toggle-list">
          {GAMES.map((g) => {
            const on = favs.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                className={`arcade-fave-toggle${on ? " is-on" : ""}`}
                onClick={() => onToggleFav(g.id)}
                aria-pressed={on}
              >
                <span className="arcade-fave-toggle-star">{on ? "⭐" : "☆"}</span>
                <span>{g.emoji} {g.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const auth = useAuth();
  const { isAnonymous, username, profile, updateProfile, ready, user, signUp, signIn, signOut, resetPassword } = auth || {};

  const [tab, setTab] = useState("claim"); // "claim" | "login"
  const [uname, setUname] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const Shell = (inner) => (
    <div className="arcade-stage">
      <BackBar />
      <div className="arcade-account">{inner}</div>
    </div>
  );

  if (!ready) return Shell(<p className="arcade-account-loading">connecting…</p>);

  // ── signed-in (named) account ──────────────────────────────────────────
  // One profile presentation: a PROFILE tab (the same public-style ProfileView
  // the world sees), an EDIT tab (avatar/theme/bio/favorites pickers), and an
  // ACCOUNT tab (email + reset + logout). Defaults to PROFILE so /me opens on
  // "your arcade", not a config form.
  if (user && !isAnonymous) {
    const meTab = ["profile", "phone", "edit", "account"].includes(tab) ? tab : "profile";
    return Shell(
      <div className="arcade-account-card">
        <div className="arcade-account-tabs">
          {[
            ["profile", "PROFILE"],
            ["phone", "PHONE"],
            ["edit", "EDIT"],
            ["account", "ACCOUNT"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`arcade-account-tab${meTab === id ? " is-active" : ""}`}
              onClick={() => { setTab(id); setError(null); setNotice(null); }}
            >
              {label}
            </button>
          ))}
        </div>

        {notice && <p className="arcade-account-notice">{notice}</p>}
        {error && <p className="arcade-account-error">{error}</p>}

        {meTab === "profile" && (
          username ? (
            <div className="arcade-profile arcade-account-profile">
              <ProfileView profile={profile} uid={user.uid} username={username} owner />
            </div>
          ) : (
            <p className="arcade-account-blurb">finish setting a username to get a public profile.</p>
          )
        )}

        {meTab === "phone" && (
          username ? (
            <Suspense fallback={<p className="arcade-account-loading">waking the phone…</p>}>
              <NopiaPhone />
            </Suspense>
          ) : (
            <p className="arcade-account-blurb">finish setting a username to get your phone & number.</p>
          )
        )}

        {meTab === "edit" && (
          username ? (
            <ProfileEditor profile={profile} updateProfile={updateProfile} />
          ) : (
            <p className="arcade-account-blurb">no username yet — nothing to edit.</p>
          )
        )}

        {meTab === "account" && (
          <>
            <span className="arcade-widget-kicker">👤 YOUR ACCOUNT</span>
            <h2 className="arcade-account-name">{username || "(no username yet)"}</h2>
            <p className="arcade-account-email">{user.email}</p>
            {profile?.number && (
              <p className="arcade-account-email">📱 {profile.number}</p>
            )}
            {username && (
              <p className="arcade-account-notice">
                <Link to={`/u/${username}`} className="arcade-account-link">view your public profile →</Link>
              </p>
            )}
            <div className="arcade-account-actions">
              <button
                type="button"
                className="arcade-share"
                disabled={busy}
                onClick={() => run(async () => {
                  await resetPassword(user.email);
                  setNotice("Password reset email sent.");
                })}
              >
                ✉ Reset password
              </button>
              <button
                type="button"
                className="arcade-share"
                disabled={busy}
                onClick={() => run(() => signOut())}
              >
                ⎋ Log out
              </button>
            </div>
            <p className="arcade-account-foot">your streaks, votes & collection are saved to this account ✦</p>
          </>
        )}
      </div>
    );
  }

  // ── anonymous: claim or log in ─────────────────────────────────────────
  return Shell(
    <div className="arcade-account-card">
      <div className="arcade-account-tabs">
        <button type="button" className={`arcade-account-tab${tab === "claim" ? " is-active" : ""}`} onClick={() => { setTab("claim"); setError(null); }}>
          CLAIM ACCOUNT
        </button>
        <button type="button" className={`arcade-account-tab${tab === "login" ? " is-active" : ""}`} onClick={() => { setTab("login"); setError(null); }}>
          LOG IN
        </button>
      </div>

      {tab === "claim" ? (
        <form
          className="arcade-account-form"
          onSubmit={(e) => { e.preventDefault(); run(() => signUp(uname, email, pw)); }}
        >
          <p className="arcade-account-blurb">
            pick a handle and save your stuff. you&apos;re already a guest — claiming keeps your
            streak & collection. no socials, just a name + email.
          </p>
          <Field label="username" value={uname} onChange={(e) => setUname(e.target.value)} placeholder="pixel_kid_2003" autoComplete="username" required />
          <Field label="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required />
          <Field label="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="6+ characters" autoComplete="new-password" minLength={6} required />
          {error && <p className="arcade-account-error">{error}</p>}
          <button type="submit" className="arcade-stumble arcade-account-submit" disabled={busy}>
            {busy ? "claiming…" : "🎟 CLAIM MY ACCOUNT"}
          </button>
        </form>
      ) : (
        <form
          className="arcade-account-form"
          onSubmit={(e) => { e.preventDefault(); run(() => signIn(email, pw)); }}
        >
          <p className="arcade-account-blurb">
            welcome back. logging in here swaps this device over to your account.
          </p>
          <Field label="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required />
          <Field label="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
          {error && <p className="arcade-account-error">{error}</p>}
          <button type="submit" className="arcade-stumble arcade-account-submit" disabled={busy}>
            {busy ? "logging in…" : "▶ LOG IN"}
          </button>
          <button
            type="button"
            className="arcade-account-link"
            disabled={busy || !email}
            onClick={() => run(async () => {
              await resetPassword(email);
              setNotice("Password reset email sent.");
            })}
          >
            forgot password?
          </button>
          {notice && <p className="arcade-account-notice">{notice}</p>}
        </form>
      )}
    </div>
  );
}
