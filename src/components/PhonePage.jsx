import BackBar from "./BackBar.jsx";
import PhonePanel from "./PhonePanel.jsx";

/* PhonePage — the dedicated, full-page Nopia at the /phone route. Kept as a
   deep-linkable fallback; all the iframe + bridge logic now lives in PhonePanel,
   which the site-wide pop-up overlay (PhoneOverlay) also reuses. */

export default function PhonePage() {
  return (
    <div className="arcade-stage">
      <BackBar />
      <PhonePanel />
    </div>
  );
}
