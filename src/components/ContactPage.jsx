import BackBar from "./BackBar.jsx";
import GameSubmitCard from "./GameSubmitCard.jsx";
import { useFormspree } from "../lib/useFormspree.js";

/* /contact — two cards: the classic "contact the webmaster" form (left) and a
   members-only "submit a game" form (right, see GameSubmitCard). Reached via the
   animated "Email Me" gif in the home footer.

   The contact form's delivery is handled by Formspree (formspree.io) — a free,
   no-backend form endpoint that emails the owner on each submit. The shared
   useFormspree hook POSTs via fetch with `Accept: application/json` so the
   visitor stays on-site and gets a retro in-page confirmation instead of
   bouncing to Formspree's page.

   The `subject` field is sent as Formspree's special `_subject` so each email's
   subject line is the visitor's subject. (No `email` field — this is a one-way
   "contact me" form, not a reply thread; we don't collect the sender's address.) */
const FORMSPREE_ID = "mnjkqeyl";

function ContactCard() {
  const { status, error, onSubmit, reset } = useFormspree(FORMSPREE_ID);

  return (
    <section className="arcade-card-panel" id="contact-top">
      <span className="arcade-widget-kicker">📧 CONTACT THE WEBMASTER</span>
      <h2 className="arcade-contact-title arcade-submit-title">Drop Me a Line</h2>
      <p className="arcade-contact-intro">
        Found a bug, have an idea, or just want to say hi? Fill out the form and
        it lands in the webmaster's inbox.
      </p>

      {status === "sent" ? (
        <div className="arcade-contact-done" role="status">
          <p className="arcade-contact-done-big">✅ Message sent!</p>
          <p>Thanks for writing in — I read every one.</p>
          <button className="arcade-stumble" type="button" onClick={reset}>
            Send another
          </button>
        </div>
      ) : (
        <form className="arcade-contact-form" onSubmit={onSubmit}>
          <label className="arcade-field">
            <span className="arcade-field-label">Your name</span>
            <input
              className="arcade-field-input"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={80}
              required
            />
          </label>

          <label className="arcade-field">
            <span className="arcade-field-label">Subject</span>
            {/* `_subject` is Formspree's special field — it sets the subject
                line of the email you receive. */}
            <input
              className="arcade-field-input"
              name="_subject"
              type="text"
              maxLength={120}
              required
            />
          </label>

          <label className="arcade-field">
            <span className="arcade-field-label">Note</span>
            <textarea
              className="arcade-editor-bio arcade-contact-note"
              name="note"
              rows={6}
              maxLength={2000}
              required
            />
          </label>

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
            {status === "sending" ? "Sending…" : "Send →"}
          </button>
        </form>
      )}
    </section>
  );
}

export default function ContactPage() {
  return (
    <div className="arcade-stage">
      <BackBar />

      <div className="arcade-contact">
        <div className="arcade-contact-grid">
          <ContactCard />
          <GameSubmitCard />
        </div>
      </div>
    </div>
  );
}
