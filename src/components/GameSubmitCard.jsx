import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthProvider.jsx";
import { useFormspree } from "../lib/useFormspree.js";
import badgerOfficer from "../assets/badger-officer.webp";

/* The second card on /contact — "Submit a Game". Lets members pitch their own
   single-file cabinet (one self-contained .html, or one .jsx component) by
   LINKING to their code; we never accept uploads, so there's nothing malicious
   to host. Submissions email the webmaster via Formspree (its own form, separate
   from the contact mailbox) and are reviewed + added by hand — the same human
   gate every game goes through today.

   Gated to claimed accounts: anonymous visitors see the badger-officer "members
   only" preview with a nudge to /me, mirroring the phone-panel gate. */

// TODO(owner): create a SECOND Formspree form for game submissions and paste its
// id here (keep the contact form's id on ContactPage). Until then the form shows
// a friendly "not wired up yet" message instead of failing.
const FORMSPREE_GAME_ID = "xgojvwav";

export default function GameSubmitCard() {
  const { isAnonymous, username, uid } = useAuth() || {};
  const claimed = !isAnonymous && !!username;
  const { status, error, onSubmit, reset } = useFormspree(FORMSPREE_GAME_ID);
  const [scored, setScored] = useState(false);

  // ── Locked: not a claimed account ────────────────────────────────────────
  if (!claimed) {
    return (
      <section className="arcade-card-panel arcade-submit-gate">
        <span className="arcade-widget-kicker">🎮 SUBMIT A GAME</span>
        <img className="arcade-submit-officer" src={badgerOfficer} alt="" aria-hidden="true" />
        <p className="arcade-account-blurb">
          Got a cabinet of your own? Claim an account to submit your own single-file
          game to the arcade.
        </p>
        <Link to="/me" className="arcade-stumble arcade-submit-cta">
          Claim / Log in →
        </Link>
      </section>
    );
  }

  // ── Sent confirmation ────────────────────────────────────────────────────
  if (status === "sent") {
    return (
      <section className="arcade-card-panel">
        <span className="arcade-widget-kicker">🎮 SUBMIT A GAME</span>
        <div className="arcade-contact-done" role="status">
          <p className="arcade-contact-done-big">✅ Submission sent!</p>
          <p>Thanks — I review every cabinet by hand and wire up the good ones.</p>
          <button className="arcade-stumble" type="button" onClick={reset}>
            Submit another
          </button>
        </div>
      </section>
    );
  }

  // ── The form (claimed accounts) ──────────────────────────────────────────
  return (
    <section className="arcade-card-panel">
      <span className="arcade-widget-kicker">🎮 SUBMIT A GAME</span>
      <h2 className="arcade-contact-title arcade-submit-title">Pitch a Cabinet</h2>
      <p className="arcade-contact-intro">
        Made a game that'd fit the arcade? Share a link and I'll take a look.
      </p>

      <ul className="arcade-submit-rules">
        <li>One self-contained file — a single <b>.html</b> game, or one <b>.jsx</b> component.</li>
        <li>No external/network calls, tracking, ads, or remote code.</li>
        <li>Must run inside the site as-is (no extra build/setup).</li>
        <li>Family-friendly and original — you own the rights.</li>
        <li>Drop a working link; everything's reviewed by hand before it goes live.</li>
      </ul>

      <form className="arcade-contact-form" onSubmit={onSubmit}>
        {/* who submitted — read from the claimed account so I know who to credit */}
        <input type="hidden" name="submitter_username" value={username || ""} />
        <input type="hidden" name="submitter_uid" value={uid || ""} />

        <label className="arcade-field">
          <span className="arcade-field-label">Game title</span>
          <input className="arcade-field-input" name="title" type="text" maxLength={60} required />
        </label>

        <label className="arcade-field">
          <span className="arcade-field-label">Your name / handle</span>
          <input className="arcade-field-input" name="author" type="text" maxLength={40} required />
        </label>

        <label className="arcade-field">
          <span className="arcade-field-label">Game type</span>
          <select className="arcade-field-input" name="type" defaultValue="html" required>
            <option value="html">HTML (single self-contained file)</option>
            <option value="react">React / JSX (single component)</option>
          </select>
        </label>

        <label className="arcade-field">
          <span className="arcade-field-label">Link to the code</span>
          <input
            className="arcade-field-input"
            name="code_url"
            type="url"
            placeholder="GitHub repo / gist, CodePen, or a hosted .html"
            maxLength={300}
            required
          />
        </label>

        <label className="arcade-field">
          <span className="arcade-field-label">Short description</span>
          <textarea
            className="arcade-editor-bio arcade-contact-note"
            name="blurb"
            rows={3}
            maxLength={200}
            placeholder="One or two lines — the cabinet pitch."
            required
          />
        </label>

        <label className="arcade-field">
          <span className="arcade-field-label">Cabinet emoji</span>
          <input
            className="arcade-field-input arcade-submit-emoji"
            name="emoji"
            type="text"
            maxLength={8}
            placeholder="🕹️"
            required
          />
        </label>

        <label className="arcade-field">
          <span className="arcade-field-label">Tags (optional)</span>
          <input
            className="arcade-field-input"
            name="tags"
            type="text"
            maxLength={80}
            placeholder="puzzle, retro, solo"
          />
        </label>

        <label className="arcade-submit-check">
          <input
            type="checkbox"
            name="has_score"
            value="yes"
            checked={scored}
            onChange={(e) => setScored(e.target.checked)}
          />
          <span>Has a leaderboard / high score?</span>
        </label>

        {scored && (
          <>
            <label className="arcade-field">
              <span className="arcade-field-label">Score label</span>
              <input
                className="arcade-field-input"
                name="score_label"
                type="text"
                maxLength={20}
                placeholder="POINTS"
              />
            </label>
            <label className="arcade-field">
              <span className="arcade-field-label">Which is better?</span>
              <select className="arcade-field-input" name="score_dir" defaultValue="higher">
                <option value="higher">Higher is better</option>
                <option value="lower">Lower is better</option>
              </select>
            </label>
          </>
        )}

        <label className="arcade-field">
          <span className="arcade-field-label">Anything else? (optional)</span>
          <textarea
            className="arcade-editor-bio arcade-contact-note"
            name="notes"
            rows={3}
            maxLength={1000}
          />
        </label>

        {/* sets the subject line of the email I receive */}
        <input type="hidden" name="_subject" value="🎮 Game submission" />

        {/* honeypot — bots fill hidden fields; humans never see this */}
        <input
          type="text"
          name="_gotcha"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
        />

        {status === "error" && <p className="arcade-contact-error">{error}</p>}

        <button
          className="arcade-stumble arcade-contact-submit"
          type="submit"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending…" : "Submit game →"}
        </button>
      </form>
    </section>
  );
}
