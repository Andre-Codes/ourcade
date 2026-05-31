import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { TapSurge, GLOBAL_CSS } from "./ADHDArcade.jsx";

// Standalone cabinet wrapper for the Tap Surge minigame. The minigame draws its
// own back button (GameHUD/GameOver), so we hide the arcade chrome and route its
// onExit back to the arcade home. The full-screen parent gives the 100%-sized
// game a box to fill.
export default function TapSurgeGame() {
  const navigate = useNavigate();
  useArcadeBackButton(false);
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  return (
    <div style={{ width: "100vw", height: "100svh", background: "#08080f", overflow: "hidden", position: "relative" }}>
      <TapSurge onExit={() => navigate("/")} />
    </div>
  );
}
