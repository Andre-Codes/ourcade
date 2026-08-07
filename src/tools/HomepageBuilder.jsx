import { useEffect, useRef, useState } from "react";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { hashUrl, shareImage } from "../lib/share.js";
import { renderHomepageCard } from "../lib/homepageCard.js";
import ShareButton from "../components/ShareButton.jsx";
import lavalampGif from "../assets/lavalamp.gif";
import emailGif from "../assets/email.gif";
import byteBadger from "../assets/byte-badger.webp";

// ── Homepage Builder '97 ─────────────────────────────────────────────────────
// Self-contained novelty tool: build a GeoCities page out of period parts and
// take a picture of it. Injects its own theme (the arcade shell CSS is all
// `arcade-` prefixed, so a local reset is safe). Single screen → the shell's
// "‹ BACK TO OURCADE" stays visible, no useArcadeBackButton.
//
// Backgrounds are SVG data-URI TILES, not asset files: one string drives both
// the CSS preview (background-image) and the share card (createPattern off the
// same URI). Data URIs are same-origin, so the canvas never gets tainted.
//
// The draft persists locally (homepage:draft). It's deliberately NOT in
// store.js's isSyncKey list — a scratch pad doesn't need a Firestore write per
// keystroke.

const svgTile = (w, h, body) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  )}`;

// Each background carries the tile plus the two colors the page needs to stay
// readable on top of it: `ink` for text, `scrim` for the panel behind prose.
const BACKGROUNDS = [
  {
    id: "stars",
    label: "★ STARFIELD",
    ink: "#e9ecff",
    scrim: "rgba(4,6,24,.66)",
    tile: svgTile(
      64,
      64,
      `<rect width="64" height="64" fill="#0b0a2a"/><g fill="#ffffff">
       <circle cx="9" cy="13" r="1.1"/><circle cx="41" cy="7" r=".9"/>
       <circle cx="23" cy="31" r="1.3"/><circle cx="55" cy="26" r="1"/>
       <circle cx="14" cy="49" r="1"/><circle cx="37" cy="57" r="1.2"/>
       <circle cx="60" cy="46" r=".8"/></g>`
    ),
  },
  {
    id: "clouds",
    label: "☁ BLUE SKY",
    ink: "#10233a",
    scrim: "rgba(255,255,255,.72)",
    tile: svgTile(
      64,
      64,
      `<rect width="64" height="64" fill="#7fb2e5"/><g fill="#ffffff" opacity=".85">
       <ellipse cx="16" cy="20" rx="14" ry="7"/><ellipse cx="26" cy="17" rx="9" ry="6"/>
       <ellipse cx="48" cy="46" rx="13" ry="6.5"/><ellipse cx="56" cy="43" rx="8" ry="5"/></g>`
    ),
  },
  {
    id: "felt",
    label: "♣ CARD TABLE",
    ink: "#f4ffe9",
    scrim: "rgba(3,26,13,.6)",
    tile: svgTile(
      64,
      64,
      `<rect width="64" height="64" fill="#0d5c2f"/>
       <g stroke="#0f6b36" stroke-width="2"><path d="M0 16h64M0 48h64M16 0v64M48 0v64"/></g>`
    ),
  },
  {
    id: "static",
    label: "▒ TV STATIC",
    ink: "#f4f4f4",
    scrim: "rgba(12,12,12,.66)",
    tile: svgTile(
      32,
      32,
      `<rect width="32" height="32" fill="#4a4a4a"/><g fill="#6f6f6f">
       <rect x="3" y="5" width="2" height="2"/><rect x="17" y="2" width="2" height="2"/>
       <rect x="25" y="11" width="2" height="2"/><rect x="8" y="18" width="2" height="2"/>
       <rect x="21" y="24" width="2" height="2"/><rect x="1" y="27" width="2" height="2"/></g>
       <g fill="#333"><rect x="12" y="9" width="2" height="2"/><rect x="28" y="21" width="2" height="2"/></g>`
    ),
  },
  {
    id: "rainbow",
    label: "🌈 RAINBOW",
    ink: "#1a1030",
    scrim: "rgba(255,255,255,.78)",
    // Square tile (not a thin 8px strip) so the parts-bin swatch, which scales
    // to background-size: 32px, shows all seven bands instead of a sliver. Rows
    // are solid, so it still repeats seamlessly across the page.
    tile: svgTile(
      56,
      56,
      `<rect width="56" height="8" y="0" fill="#ff3b3b"/><rect width="56" height="8" y="8" fill="#ff9b1f"/>
       <rect width="56" height="8" y="16" fill="#ffe600"/><rect width="56" height="8" y="24" fill="#2fd45a"/>
       <rect width="56" height="8" y="32" fill="#2f9bff"/><rect width="56" height="8" y="40" fill="#5a3bff"/>
       <rect width="56" height="8" y="48" fill="#c13bff"/>`
    ),
  },
  {
    id: "brick",
    label: "🧱 BRICK WALL",
    ink: "#ffe9c9",
    scrim: "rgba(38,12,6,.66)",
    tile: svgTile(
      64,
      32,
      `<rect width="64" height="32" fill="#7a2e20"/><g fill="#b1543f">
       <rect x="1" y="1" width="30" height="14"/><rect x="33" y="1" width="30" height="14"/>
       <rect x="17" y="17" width="30" height="14"/><rect x="-15" y="17" width="30" height="14"/>
       <rect x="49" y="17" width="30" height="14"/></g>`
    ),
  },
  {
    id: "notebook",
    label: "📓 NOTEBOOK",
    ink: "#1b2a5a",
    scrim: "rgba(255,255,255,.7)",
    tile: svgTile(
      64,
      28,
      `<rect width="64" height="28" fill="#fdfbef"/><path d="M0 27.5h64" stroke="#9fc3e8" stroke-width="1"/>`
    ),
  },
  {
    id: "matrix",
    label: "💻 THE MATRIX",
    ink: "#4bff77",
    scrim: "rgba(0,10,3,.72)",
    tile: svgTile(
      32,
      64,
      `<rect width="32" height="64" fill="#020604"/><g fill="#1f8b3a">
       <rect x="6" y="4" width="3" height="8"/><rect x="6" y="16" width="3" height="5"/>
       <rect x="20" y="30" width="3" height="10"/><rect x="20" y="46" width="3" height="6"/>
       <rect x="6" y="52" width="3" height="7"/></g>`
    ),
  },
];

const WIDGETS = [
  { id: "lavalamp", label: "LAVA LAMP", src: lavalampGif },
  { id: "email", label: "E-MAIL ME", src: emailGif },
  { id: "badger", label: "MASCOT", src: byteBadger },
  { id: "nedry", label: "AH AH AH", src: "/nedry-wag.gif" },
];

// Signatures the guestbook gag draws from, in strict chronological order of
// how annoying they were to receive.
const GUESTS = [
  ["xX_ShadowWolf_Xx", "cool page!!! check out mine"],
  ["dialup_dave", "took 4 min to load. worth it."],
  ["~*~Krystal~*~", "luv the background where did u get it"],
  ["webmaster99", "your hit counter is broken lol"],
  ["FrogBoy2000", "AOL keyword: FROG"],
  ["netscape_nav", "best viewed in 800x600"],
  ["MoM", "andre come eat dinner"],
  ["sk8rboi_88", "add me 2 ur links page!!"],
  ["angelfire_amy", "this is the best site on the internet"],
  ["h4x0r_pete", "nice page. i am inside your computer."],
];

const MARQUEES = [
  "*** WELCOME TO MY CORNER OF THE WORLD WIDE WEB ***",
  "!!! THIS PAGE IS BEST VIEWED WITH NETSCAPE NAVIGATOR 3.0 !!!",
  ">>> SIGN MY GUESTBOOK OR ELSE <<<",
  "~*~ thanx 4 visiting ~*~ come back soon ~*~",
  "NEW PICS COMING SOON!!! (when i get a scanner)",
];

const BLINKS = [
  "NEW! UPDATED 08/06/97",
  "*** UNDER CONSTRUCTION ***",
  "!!! YOU ARE THE LUCKY VISITOR !!!",
  "FREE HOMEPAGE — NO BANNER ADS*",
  "CLICK HERE FOR NOTHING",
];

const DEFAULT_PAGE = {
  name: "MY HOME PAGE",
  bg: "stars",
  about:
    "hi. welcome 2 my page. it is still under construction but check back soon because i am adding a links page and maybe some MIDIs.",
  marquee: MARQUEES[0],
  blink: BLINKS[0],
  counter: true,
  construction: true,
  guestbook: true,
  webring: true,
  widgets: ["lavalamp", "email"],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Deterministic 6-digit hit count, seeded from the page name — so the number is
// stable across reloads and matches whatever ends up on the share card. FNV-1a.
function hitCount(name) {
  let h = 2166136261;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String((Math.abs(h) % 900000) + 100000);
}

// Merge a stored draft over the defaults so a shape change (a part added later)
// can never leave a saved page missing a field.
function loadDraft() {
  const saved = lsGetJSON("homepage:draft", null);
  if (!saved || typeof saved !== "object") return DEFAULT_PAGE;
  const widgets = Array.isArray(saved.widgets)
    ? saved.widgets.filter((id) => WIDGETS.some((w) => w.id === id))
    : DEFAULT_PAGE.widgets;
  const bg = BACKGROUNDS.some((b) => b.id === saved.bg) ? saved.bg : DEFAULT_PAGE.bg;
  return { ...DEFAULT_PAGE, ...saved, bg, widgets };
}

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #07080f; color: #eef0ff; font-family: 'Share Tech Mono', 'Courier New', monospace; }

  .hb-app {
    min-height: 100vh; padding: 24px 14px 72px;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    background:
      radial-gradient(ellipse 60% 45% at 50% 0%, rgba(232,255,71,.10), transparent 70%),
      radial-gradient(ellipse 50% 50% at 50% 100%, rgba(63,169,255,.08), transparent 65%),
      #07080f;
  }

  .hb-head { text-align: center; }
  .hb-head h1 {
    font-family: 'Press Start 2P', monospace; font-size: 1rem; color: #e8ff47;
    letter-spacing: .04em; text-shadow: 0 0 14px rgba(232,255,71,.35);
  }
  .hb-head .sub { margin-top: 8px; font-size: .82rem; color: #8a90b5; letter-spacing: .04em; }

  .hb-bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .hb-btn {
    font-family: 'Press Start 2P', monospace; font-size: .5rem; letter-spacing: .04em;
    color: #eef0ff; background: #12141f; border: 2px solid #2a2f4a; border-radius: 8px;
    padding: 10px 12px; cursor: pointer; transition: all .14s;
  }
  .hb-btn:hover { border-color: #e8ff47; color: #e8ff47; }
  .hb-btn:disabled { opacity: .5; cursor: default; }

  /* ── layout: preview beside the parts bin, stacked on phones ── */
  .hb-wrap {
    width: 100%; max-width: 1040px; display: grid; gap: 16px;
    grid-template-columns: minmax(0, 1fr) 290px; align-items: start;
  }
  @media (max-width: 880px) { .hb-wrap { grid-template-columns: minmax(0, 1fr); } }

  /* ── fake browser chrome ── */
  .hb-browser { border: 2px solid #2a2f4a; border-radius: 10px; overflow: hidden; background: #c9c9d4; }
  .hb-chrome {
    display: flex; align-items: center; gap: 8px; padding: 7px 9px;
    background: linear-gradient(#e9e9f2, #b9b9c8); border-bottom: 2px solid #8a8a9a;
  }
  .hb-chrome-dots { display: flex; gap: 5px; }
  .hb-chrome-dots i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid #6a6a7a; display: block; }
  .hb-url {
    flex: 1; min-width: 0; font-size: .68rem; color: #23233a; background: #fff;
    border: 1px solid #8a8a9a; border-radius: 3px; padding: 3px 7px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ── the page itself ── */
  .hb-page {
    min-height: 420px; padding: 20px 16px 26px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 14px;
    background-repeat: repeat; font-family: 'Times New Roman', Times, serif;
  }

  .hb-wordart {
    font-family: 'Press Start 2P', monospace; font-size: clamp(.9rem, 3.4vw, 1.5rem);
    line-height: 1.5; letter-spacing: .02em; transform: skewY(-3deg);
    background: linear-gradient(#fff32e 0%, #ff8a1f 45%, #d81c1c 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    -webkit-text-stroke: 1px #3a1000;
    filter: drop-shadow(2px 2px 0 #3a1000) drop-shadow(4px 5px 5px rgba(0,0,0,.5));
    word-break: break-word; max-width: 100%;
  }

  .hb-marquee {
    width: 100%; overflow: hidden; white-space: nowrap;
    border-top: 2px ridge currentColor; border-bottom: 2px ridge currentColor; padding: 4px 0;
    font-family: 'Share Tech Mono', monospace; font-size: .8rem;
  }
  .hb-marquee span { display: inline-block; padding-left: 100%; animation: hb-scroll 12s linear infinite; }
  @keyframes hb-scroll { from { transform: translateX(0); } to { transform: translateX(-100%); } }

  .hb-construction {
    font-family: 'Press Start 2P', monospace; font-size: .52rem; letter-spacing: .06em;
    color: #241a00; padding: 9px 14px; border: 3px solid #241a00; border-radius: 4px;
    background: repeating-linear-gradient(45deg, #ffd23f 0 12px, #241a00 12px 24px);
    text-shadow: 0 0 4px #ffd23f, 1px 1px 0 #ffd23f, -1px -1px 0 #ffd23f;
  }

  .hb-blink {
    font-family: 'Press Start 2P', monospace; font-size: .5rem; letter-spacing: .05em;
    color: #ff2d2d; animation: hb-blink 1.1s step-end infinite; text-shadow: 0 0 6px rgba(0,0,0,.6);
  }
  @keyframes hb-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

  .hb-about {
    max-width: 46ch; font-size: .96rem; line-height: 1.6; padding: 12px 14px;
    border-radius: 6px; background: var(--scrim);
  }

  .hb-widgets { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; align-items: flex-end; }
  .hb-widgets img { height: 74px; width: auto; image-rendering: pixelated; }

  .hb-counter {
    font-family: 'Share Tech Mono', monospace; font-size: .78rem;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;
  }
  .hb-digits { display: inline-flex; gap: 2px; }
  .hb-digits i {
    font-style: normal; font-family: 'Press Start 2P', monospace; font-size: .62rem;
    color: #4bff77; background: #04120a; border: 1px solid #0b3f1e; padding: 4px 3px; min-width: 15px;
  }

  .hb-guestbook {
    width: 100%; max-width: 46ch; padding: 12px 14px; border-radius: 6px;
    background: var(--scrim); text-align: left;
  }
  .hb-guestbook h3 {
    font-family: 'Press Start 2P', monospace; font-size: .5rem; letter-spacing: .05em;
    margin-bottom: 9px; text-align: center;
  }
  .hb-guestbook ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .hb-guestbook li { font-size: .82rem; line-height: 1.45; }
  .hb-guestbook b { font-weight: 700; }
  .hb-sign {
    display: block; margin: 10px auto 0; cursor: pointer; font-family: 'Share Tech Mono', monospace;
    font-size: .78rem; padding: 5px 12px; color: #10131f;
    background: linear-gradient(#fff, #c6c6d2); border: 2px outset #e8e8f0; border-radius: 3px;
  }
  .hb-sign:active { border-style: inset; }

  .hb-webring { font-family: 'Share Tech Mono', monospace; font-size: .74rem; opacity: .9; }

  /* ── parts bin ── */
  .hb-parts {
    display: flex; flex-direction: column; gap: 14px; padding: 14px;
    background: #0b0d16; border: 2px solid #2a2f4a; border-radius: 10px;
  }
  .hb-parts h2 {
    font-family: 'Press Start 2P', monospace; font-size: .58rem; color: #3fffd0; letter-spacing: .06em;
  }
  .hb-field { display: flex; flex-direction: column; gap: 5px; }
  .hb-label {
    font-family: 'Press Start 2P', monospace; font-size: .46rem; letter-spacing: .05em; color: #8a90b5;
  }
  .hb-input, .hb-area {
    font-family: 'Share Tech Mono', monospace; font-size: .86rem; color: #eef0ff;
    background: #04050b; border: 2px solid #2a2f4a; border-radius: 6px; padding: 8px 9px; width: 100%;
  }
  .hb-input:focus, .hb-area:focus { outline: none; border-color: #e8ff47; }
  .hb-area { resize: vertical; min-height: 74px; line-height: 1.45; }

  .hb-swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .hb-swatch {
    aspect-ratio: 1; border: 2px solid #2a2f4a; border-radius: 6px; cursor: pointer;
    background-repeat: repeat; background-size: 32px; padding: 0;
  }
  .hb-swatch.on { border-color: #e8ff47; box-shadow: 0 0 0 2px rgba(232,255,71,.25); }

  .hb-toggles { display: flex; flex-wrap: wrap; gap: 6px; }
  .hb-toggle {
    font-family: 'Press Start 2P', monospace; font-size: .44rem; letter-spacing: .04em;
    color: #8a90b5; background: #04050b; border: 2px solid #2a2f4a; border-radius: 999px;
    padding: 7px 10px; cursor: pointer; transition: all .14s;
  }
  .hb-toggle.on { color: #04050b; background: #3fffd0; border-color: #3fffd0; }

  .hb-foot { font-size: .76rem; color: #6f7595; text-align: center; letter-spacing: .03em; }
`;

export default function HomepageBuilder() {
  const [page, setPage] = useState(loadDraft);
  const [signed, setSigned] = useState([]);
  const [cardStatus, setCardStatus] = useState(null); // "busy" | "saved" | "shared" | "failed"
  const cardTimer = useRef(null);

  useEffect(() => () => clearTimeout(cardTimer.current), []);
  useEffect(() => {
    lsSetJSON("homepage:draft", page);
  }, [page]);

  const set = (patch) => setPage((p) => ({ ...p, ...patch }));
  const toggle = (key) => setPage((p) => ({ ...p, [key]: !p[key] }));
  const toggleWidget = (id) =>
    setPage((p) => ({
      ...p,
      widgets: p.widgets.includes(id)
        ? p.widgets.filter((w) => w !== id)
        : [...p.widgets, id],
    }));

  const surprise = () =>
    setPage((p) => ({
      ...p,
      bg: pick(BACKGROUNDS).id,
      marquee: pick(MARQUEES),
      blink: pick(BLINKS),
      counter: Math.random() < 0.8,
      construction: Math.random() < 0.8,
      guestbook: Math.random() < 0.7,
      webring: Math.random() < 0.6,
      widgets: WIDGETS.filter(() => Math.random() < 0.5).map((w) => w.id),
    }));

  const sign = () => {
    const [who, note] = pick(GUESTS);
    setSigned((list) => [...list, { who, note, at: Date.now() }].slice(-4));
  };

  const bg = BACKGROUNDS.find((b) => b.id === page.bg) || BACKGROUNDS[0];
  const widgets = WIDGETS.filter((w) => page.widgets.includes(w.id));
  const hits = hitCount(page.name);
  const slug =
    (page.name || "home").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "home";

  const saveCard = async () => {
    setCardStatus("busy");
    let result = "failed";
    try {
      const blob = await renderHomepageCard({
        page,
        bg,
        hits,
        widgets: widgets.map((w) => w.src),
        guests: signed,
      });
      result = await shareImage({
        blob,
        filename: `homepage-${slug}.png`,
        title: "Ourcade — Homepage Builder '97",
        text: `I built "${page.name}" in the Ourcade Homepage Builder`,
        url: hashUrl("/play/homepage-builder"),
      });
    } catch {
      result = "failed";
    }
    setCardStatus(result === "cancelled" ? null : result);
    clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => setCardStatus(null), 1800);
  };

  const cardLabel =
    cardStatus === "busy" ? "🖼 RENDERING…"
    : cardStatus === "saved" ? "✓ SAVED!"
    : cardStatus === "shared" ? "✓ SHARED!"
    : cardStatus === "failed" ? "CARD FAILED"
    : "🖼 SAVE AS CARD";

  return (
    <>
      <style>{style}</style>
      <div className="hb-app">
        <div className="hb-head">
          <h1>HOMEPAGE BUILDER &apos;97</h1>
          <div className="sub">build your corner of the web · 2MB of free space</div>
        </div>

        <div className="hb-bar">
          <button className="hb-btn" onClick={surprise}>🎲 SURPRISE ME</button>
          <button className="hb-btn" onClick={saveCard} disabled={cardStatus === "busy"}>
            {cardLabel}
          </button>
          <ShareButton
            label="SHARE THE TOOL"
            title="Ourcade — Homepage Builder '97"
            text="Build your own GeoCities page on Ourcade"
            url={hashUrl("/play/homepage-builder")}
          />
        </div>

        <div className="hb-wrap">
          {/* ── live preview, in period-correct browser chrome ── */}
          <div className="hb-browser">
            <div className="hb-chrome">
              <div className="hb-chrome-dots">
                <i style={{ background: "#ff6a5e" }} />
                <i style={{ background: "#ffd23f" }} />
                <i style={{ background: "#3fd07a" }} />
              </div>
              <div className="hb-url">http://www.ourcade.net/~{slug}/index.html</div>
            </div>

            <div
              className="hb-page"
              style={{
                backgroundImage: `url("${bg.tile}")`,
                color: bg.ink,
                "--scrim": bg.scrim,
              }}
            >
              <div className="hb-wordart">{page.name || "UNTITLED PAGE"}</div>

              {page.marquee && (
                <div className="hb-marquee">
                  <span>{page.marquee}</span>
                </div>
              )}

              {page.construction && (
                <div className="hb-construction">🚧 UNDER CONSTRUCTION 🚧</div>
              )}

              {page.blink && <div className="hb-blink">{page.blink}</div>}

              {page.about && <p className="hb-about">{page.about}</p>}

              {widgets.length > 0 && (
                <div className="hb-widgets">
                  {widgets.map((w) => (
                    <img key={w.id} src={w.src} alt={w.label} />
                  ))}
                </div>
              )}

              {page.counter && (
                <div className="hb-counter">
                  <span>you are visitor number</span>
                  <span className="hb-digits">
                    {hits.split("").map((d, i) => (
                      <i key={i}>{d}</i>
                    ))}
                  </span>
                </div>
              )}

              {page.guestbook && (
                <div className="hb-guestbook">
                  <h3>✍ GUESTBOOK</h3>
                  <ul>
                    {signed.length === 0 ? (
                      <li>
                        <em>no entries yet. be the first!!</em>
                      </li>
                    ) : (
                      signed.map((g) => (
                        <li key={g.at}>
                          <b>{g.who}</b> — {g.note}
                        </li>
                      ))
                    )}
                  </ul>
                  <button className="hb-sign" onClick={sign}>
                    sign my guestbook
                  </button>
                </div>
              )}

              {page.webring && (
                <div className="hb-webring">◄ prev · OURCADE WEBRING · next ►</div>
              )}
            </div>
          </div>

          {/* ── parts bin ── */}
          <div className="hb-parts">
            <h2>🧰 PARTS</h2>

            <div className="hb-field">
              <label className="hb-label" htmlFor="hb-name">PAGE NAME</label>
              <input
                id="hb-name"
                className="hb-input"
                value={page.name}
                maxLength={38}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>

            <div className="hb-field">
              <span className="hb-label">WALLPAPER</span>
              <div className="hb-swatches">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.label}
                    aria-label={b.label}
                    aria-pressed={page.bg === b.id}
                    className={`hb-swatch${page.bg === b.id ? " on" : ""}`}
                    style={{ backgroundImage: `url("${b.tile}")` }}
                    onClick={() => set({ bg: b.id })}
                  />
                ))}
              </div>
            </div>

            <div className="hb-field">
              <label className="hb-label" htmlFor="hb-marquee">SCROLLING MARQUEE</label>
              <input
                id="hb-marquee"
                className="hb-input"
                value={page.marquee}
                maxLength={90}
                placeholder="(leave blank for none)"
                onChange={(e) => set({ marquee: e.target.value })}
              />
            </div>

            <div className="hb-field">
              <label className="hb-label" htmlFor="hb-blink">BLINKING TEXT</label>
              <input
                id="hb-blink"
                className="hb-input"
                value={page.blink}
                maxLength={44}
                placeholder="(leave blank for none)"
                onChange={(e) => set({ blink: e.target.value })}
              />
            </div>

            <div className="hb-field">
              <label className="hb-label" htmlFor="hb-about">ABOUT ME</label>
              <textarea
                id="hb-about"
                className="hb-area"
                value={page.about}
                maxLength={260}
                onChange={(e) => set({ about: e.target.value })}
              />
            </div>

            <div className="hb-field">
              <span className="hb-label">TRIMMINGS</span>
              <div className="hb-toggles">
                <button
                  type="button"
                  aria-pressed={page.construction}
                  className={`hb-toggle${page.construction ? " on" : ""}`}
                  onClick={() => toggle("construction")}
                >
                  🚧 CONSTRUCTION
                </button>
                <button
                  type="button"
                  aria-pressed={page.counter}
                  className={`hb-toggle${page.counter ? " on" : ""}`}
                  onClick={() => toggle("counter")}
                >
                  🔢 HIT COUNTER
                </button>
                <button
                  type="button"
                  aria-pressed={page.guestbook}
                  className={`hb-toggle${page.guestbook ? " on" : ""}`}
                  onClick={() => toggle("guestbook")}
                >
                  ✍ GUESTBOOK
                </button>
                <button
                  type="button"
                  aria-pressed={page.webring}
                  className={`hb-toggle${page.webring ? " on" : ""}`}
                  onClick={() => toggle("webring")}
                >
                  💍 WEBRING
                </button>
              </div>
            </div>

            <div className="hb-field">
              <span className="hb-label">ANIMATED GIFS</span>
              <div className="hb-toggles">
                {WIDGETS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={page.widgets.includes(w.id)}
                    className={`hb-toggle${page.widgets.includes(w.id) ? " on" : ""}`}
                    onClick={() => toggleWidget(w.id)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="hb-btn" onClick={() => setPage(DEFAULT_PAGE)}>
              ↺ START OVER
            </button>
          </div>
        </div>

        <p className="hb-foot">
          your page saves itself in this browser. nowhere else. ✦
        </p>
      </div>
    </>
  );
}
