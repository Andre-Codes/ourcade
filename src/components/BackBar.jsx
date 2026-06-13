import { Link } from "react-router-dom";

/* BackBar — a lightweight, IN-FLOW back affordance for normal pages (Scores,
   Profile, Account, Quiz, Flash, Stumble). Replaces the old fixed neon
   "cabinet chrome" that floated over content and overlapped page elements.
   It scrolls with the page and can't cover anything. Full-screen GAMES keep
   their own floating exit (GamePage) since they have no other way out.

   `to` defaults to home; pass a label to tweak the text. */
export default function BackBar({ to = "/", label = "BACK TO OURCADE" }) {
  return (
    <div className="arcade-backbar">
      <Link to={to} className="arcade-backbar-link">
        ‹ {label}
      </Link>
      <span className="arcade-backbar-badge" aria-hidden="true">OURCADE</span>
    </div>
  );
}
