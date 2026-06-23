import { useState } from "react";

/* Shared submit logic for the site's Formspree forms (Contact + Game Submission).
   We POST the form's FormData with `Accept: application/json` so the visitor
   stays on-site and gets a retro in-page confirmation instead of bouncing to
   Formspree's own page (no @formspree/react dependency needed).

   Pass a Formspree form ID. If it's still the placeholder, the form reports as
   not-yet-wired so the UI can show a friendly "mailbox isn't hooked up" message
   instead of silently failing. Returns the submit handler + status/error state. */
const PLACEHOLDER = "REPLACE_WITH_FORMSPREE_ID";

export function useFormspree(formId) {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");
  const configured = !!formId && formId !== PLACEHOLDER;

  async function onSubmit(e) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;

    if (!configured) {
      setError("The mailbox isn't wired up yet — check back soon.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`https://formspree.io/f/${formId}`, {
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

  return { status, error, configured, onSubmit, reset: () => setStatus("idle") };
}
