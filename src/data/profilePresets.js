// Curated picker sets for the public profile (avatar emoji + theme accent).
// Old-arcade flavored; kept small so /me stays a quick, no-pressure edit.

export const AVATARS = [
  "🕹️", "👾", "🎮", "🐍", "⚡", "🎨", "🎹", "💥",
  "🧠", "👑", "🤖", "🛸", "🔥", "🌙", "⭐", "💀",
  "🦊", "🐲", "🍄", "💎", "🎯", "🃏", "♠️", "🎲",
];

export const THEMES = [
  { id: "aqua", color: "#3fffd0" },
  { id: "lime", color: "#e8ff47" },
  { id: "violet", color: "#b44dff" },
  { id: "pink", color: "#ff4d72" },
  { id: "gold", color: "#ffd23f" },
  { id: "blue", color: "#0a84ff" },
  { id: "orange", color: "#ff9500" },
  { id: "green", color: "#34c759" },
];

export const DEFAULT_AVATAR = AVATARS[0];
export const DEFAULT_THEME = THEMES[0].id;

export const themeColor = (id) =>
  THEMES.find((t) => t.id === id)?.color || THEMES[0].color;
