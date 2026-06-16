import { Component } from "react";

/* ErrorBoundary — the floor's safety net.

   React only surfaces render/lifecycle errors to a class component's
   getDerivedStateFromError / componentDidCatch (there is no hook form), so this
   stays a class. It wraps the whole route tree in App.jsx: if a game or page
   throws while rendering, the user gets an on-theme "out of order" cabinet card
   with a way back to the floor instead of a blank white screen.

   Two escape hatches:
   - "kick it" reloads the page (clears whatever transient state wedged it).
   - "back to the floor" navigates home via a hard href (we can't use the router
     here — the error may have come from inside it — so a plain link is safest).

   resetKey: pass a value that changes on navigation (e.g. the pathname) and the
   boundary auto-clears when the user moves to a new route, so one bad page
   doesn't trap the rest of the site. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // No telemetry backend wired up; a console error is enough to debug from a
    // user's report. Kept intentionally quiet otherwise.
    if (typeof console !== "undefined") {
      console.error("Ourcade caught a render error:", error, info?.componentStack);
    }
  }

  componentDidUpdate(prev) {
    // Clear the error when the route changes so navigating away recovers.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      // BASE_URL keeps the home link correct on project-page deploys (/ourcade/).
      const home = import.meta.env.BASE_URL || "/";
      return (
        <div className="arcade-notfound">
          <p style={{ fontSize: "3rem", margin: 0 }} aria-hidden="true">🚧</p>
          <h1 style={{ margin: 0 }}>OUT OF ORDER</h1>
          <p style={{ maxWidth: "32ch", textAlign: "center", opacity: 0.85 }}>
            This cabinet glitched out. Give it a kick — or head back to the floor.
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <button
              type="button"
              className="arcade-back-link"
              style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }}
              onClick={() => window.location.reload()}
            >
              ↻ kick it
            </button>
            <a href={home} className="arcade-back-link">← back to the floor</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
