import { useState } from "react";
import BackBar from "./BackBar.jsx";

/* /contact — a deliberately old-school "contact the webmaster" form: name,
   subject, and a note. Reached via the classic animated "Email Me" gif in the
   home footer. Delivery is handled by Formspree (formspree.io) — a free,
   no-backend form endpoint that emails the owner on each submit. We POST via
   fetch with `Accept: application/json` so the visitor stays on-site and gets
   a retro in-page confirmation instead of bouncing to Formspree's page (no
   @formspree/react dependency needed for this).

   The `subject` field is sent as Formspree's special `_subject` so each email's
   subject line is the visitor's subject. (No `email` field — this is a one-way
   "contact me" form, not a reply thread; we don't collect the sender's address.) */
const FORMSPREE_ID = "mnjkqeyl";
const FORMSPREE_URL = `https://formspree.io/f/${FORMSPREE_ID}`;
const CONFIGURED = FORMSPREE_ID !== "REPLACE_WITH_FORMSPREE_ID";

export default function ContactPage() {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;

    if (!CONFIGURED) {
      setError("The mailbox isn't wired up yet — check back soon.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setError("");
    try {
      const res = await fetch(FORMSPREE_URL, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (res.ok) {
        setStatus("sent");
        form.reset();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.errors?.[0]?.message || "Something went wrong — try again in a bit.");
        setStatus("error");
      }
    } catch {
      setError("Couldn't reach the mailroom (offline?). Try again later.");
      setStatus("error");
    }
  }

  return (
    <div className="arcade-stage">
      <BackBar />

      <div className="arcade-contact" id="contact-top">
        <span className="arcade-widget-kicker">📧 CONTACT THE WEBMASTER</span>
        <h1 className="arcade-contact-title">Drop Me a Line</h1>
        <p className="arcade-contact-intro">
          Found a bug, have an idea, or just want to say hi? Fill out the form and
          it lands in the webmaster's inbox.
        </p>

        {status === "sent" ? (
          <div className="arcade-contact-done" role="status">
            <p className="arcade-contact-done-big">✅ Message sent!</p>
            <p>Thanks for writing in — I read every one.</p>
            <button className="arcade-stumble" type="button" onClick={() => setStatus("idle")}>
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
      </div>
    </div>
  );
}
