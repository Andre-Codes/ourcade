import { Link } from "react-router-dom";
import FlashChannel from "./FlashChannel.jsx";

// Dedicated /flash route — reuses the game-stage back-chrome and runs the lean-back
// "channel" that auto-advances through the whole archive (a TV of old Flash).
export default function FlashPage() {
  return (
    <div className="arcade-stage">
      <div className="arcade-cabinet-chrome">
        <Link to="/" className="arcade-back" title="Back to Ourcade" aria-label="Back to Ourcade">
          ‹ BACK TO OURCADE
        </Link>
        <span className="arcade-cabinet-badge" aria-hidden="true">OURCADE</span>
      </div>

      <div className="arcade-flash-page">
        <FlashChannel />
      </div>
    </div>
  );
}
