import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { Splitter, GLOBAL_CSS } from "./ADHDArcade.jsx";

// Standalone cabinet wrapper for the Splitter minigame. See TapSurge.jsx for
// the shared pattern (hide arcade chrome, route onExit home, full-screen parent).
export default function SplitterGame() {
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
      <Splitter onExit={() => navigate("/")} />
    </div>
  );
}
