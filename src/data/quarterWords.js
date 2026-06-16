/* The Daily Quarter — word pools.

   ANSWERS: the rotation pool the daily solution is drawn from (via rotateDaily,
   so every device sees the same word today and the whole list cycles with no
   repeats before any word comes back). Kept to common, fair, unambiguous
   5-letter words — nothing obscure, no proper nouns, no plurals-of-convenience.

   GUESSES: extra words accepted as valid guesses but never chosen as the answer
   (so the player isn't limited to the answer pool). ANSWERS are always valid
   guesses too; the accepted set is the union of both.

   Pure data, pure JS — importable by the game and by any headless check. */

// ~120 fair daily answers. Add freely; order doesn't matter (rotation reshuffles).
export const ANSWERS = [
  "arial", "audio", "badge", "blast", "block", "boost", "brave", "bytes",
  "cable", "cabin", "cards", "chase", "cheat", "chime", "click", "clock", "cloud",
  "coins", "combo", "crash", "crawl", "crypt", "dance", "demos", "dials", "diner",
  "disco", "drift", "drive", "eight", "ember", "extra", "flash", "fleet", "flick",
  "floor", "fonts", "frame", "ghost", "glide", "glory", "glyph", "grind", "guild",
  "heart", "hertz", "hyper", "icons", "input", "jelly", "joker", "joust", "jumps",
  "kiosk", "knack", "laser", "ledge", "level", "lobby", "lucky", "magic", "mecha",
  "medal", "mixer", "modem", "mouse", "ninja", "nokia", "noise", "orbit", "panic",
  "pause", "pinks", "pixel", "plays", "point", "power", "press", "prize", "quest",
  "quirk", "quote", "radio", "ranks", "relic", "retro", "robot", "scope", "score",
  "shift", "skill", "slime", "sonic", "space", "speed", "spike", "spins", "split",
  "stack", "stars", "start", "surge", "swarm", "synth", "table", "tapes",
  "throw", "tiles", "timer", "token", "tower", "track", "vapor", "video", "vinyl",
  "vivid", "vocal", "wager", "wheel", "wired", "zappy", "zones",
].filter((w) => w.length === 5);

// Extra accepted guesses (common words not in the answer pool). Keep additive.
export const GUESSES = [
  "about", "above", "alert", "alien", "alpha", "amber", "angle", "apple", "arena",
  "armor", "atlas", "beach", "beats", "blaze", "bonus", "boxes", "brain", "bread",
  "break", "bring", "build", "cache", "candy", "chess", "chips", "civic", "clean",
  "clear", "climb", "coach", "color", "craft", "crown", "dealt", "depth", "dodge",
  "doors", "draft", "dream", "earth", "elite", "enjoy", "enter", "epoch", "event",
  "fairy", "feast", "fight", "first", "flame", "flute", "force", "found", "fresh",
  "front", "fruit", "games", "giant", "glass", "grand", "grass", "great", "green",
  "group", "happy", "hello", "house", "human", "ideal", "image", "index", "ivory",
  "jewel", "juice", "knife", "known", "lemon", "light", "lunar", "lunch", "major",
  "march", "match", "metal", "money", "month", "moral", "mount", "music", "night",
  "noble", "north", "ocean", "offer", "olive", "onion", "opera", "order", "other",
  "paint", "party", "peach", "pearl", "phone", "piano", "place", "plant", "plate",
  "plaza", "plume", "pride", "print", "proud", "pulse", "quiet", "quill", "raven",
  "reach", "ready", "reign", "river", "round", "royal", "rugby", "scale", "scene",
  "shade", "shape", "share", "shine", "shore", "siren", "sleep", "smile", "solar",
  "sound", "south", "spark", "spell", "spice", "spore", "stage", "steam", "steel",
  "stone", "storm", "story", "study", "sugar", "sweet", "swift", "sword", "teach",
  "teeth", "tempo", "theme", "tiger", "topaz", "torch", "trace", "train", "trend",
  "tribe", "trust", "ultra", "union", "value", "viper", "vista", "vital", "voice",
  "voter", "waltz", "watch", "water", "weave", "whale", "while", "white", "world",
  "worth", "yacht", "yield", "young", "zebra", "zesty",
].filter((w) => w.length === 5);

// The full set a guess is checked against (answers count as valid guesses too).
export const VALID = new Set([...ANSWERS, ...GUESSES]);
