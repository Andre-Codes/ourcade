import { useEffect, useRef, useState } from "react";
import { share } from "../lib/share.js";

// Native share affordance. On phones this opens the OS share sheet; on desktop
// it copies the link and briefly flips the label to "Copied!". Pass contextual
// title/text/url — url defaults to the current page.
export default function ShareButton({
  title = "Ourcade",
  text,
  url,
  label = "Share",
  className = "",
}) {
  const [status, setStatus] = useState(null); // "copied" | "failed" | null
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await share({ title, text, url });
    if (result === "copied" || result === "failed") {
      setStatus(result);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus(null), 1800);
    }
  };

  const text_ =
    status === "copied" ? "✓ Link copied!" : status === "failed" ? "Copy failed" : `📤 ${label}`;

  return (
    <button
      type="button"
      className={`arcade-share${className ? ` ${className}` : ""}`}
      onClick={onClick}
    >
      {text_}
    </button>
  );
}
