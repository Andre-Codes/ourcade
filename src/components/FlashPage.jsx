import FlashChannel from "./FlashChannel.jsx";
import BackBar from "./BackBar.jsx";

// Dedicated /flash route — an in-flow back bar over the lean-back "channel" that
// auto-advances through the whole archive (a TV of old Flash).
export default function FlashPage() {
  return (
    <div className="arcade-stage">
      <BackBar />

      <div className="arcade-flash-page">
        <FlashChannel />
      </div>
    </div>
  );
}
