import { useEffect, useMemo, useState } from "react";
import { loadVault, VAULT_INDEX, searchVault } from "../data/vault.js";
import ArtifactCard, { KIND_LABEL } from "./ArtifactCard.jsx";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";
import vaultIcon from "../assets/page-icons/vault.webp";

/* /vault — THE VAULT. The whole back catalogue of the arcade's timeless internet
   finds (stumble + weird + curiosities, ever). The daily site only ever shows you
   "today"; this is the depth — a wanderable library, not a feed. Finite, no
   algorithm: search + a kind filter + load-more, newest-first by default. The
   corpus is a build-time snapshot of the Firestore archive (see vault.js /
   scripts/snapshot-archive.js), lazy-loaded as its own chunk. */

const PAGE = 24; // how many cards to reveal per "load more"

// Short chip labels (the long KIND_LABEL is the on-card flavor). Order is the
// display order; only kinds actually present get a chip.
const KIND_CHIP = {
  wiki: "📖 wiki",
  site: "🌐 sites",
  patent: "📜 patents",
  game: "🕹️ games",
  mystery: "❓ mysteries",
  video: "📺 video",
  image: "🖼️ images",
  flash: "📼 flash",
};
const KIND_ORDER = Object.keys(KIND_CHIP);

export default function VaultPage() {
  const [pool, setPool] = useState(null); // null = loading
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let alive = true;
    loadVault().then((items) => {
      if (alive) setPool(items);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Which kind chips to show — only those present in the corpus, in KIND_ORDER.
  const kinds = useMemo(() => {
    if (!pool) return [];
    const present = new Set(pool.map((a) => a.kind));
    return KIND_ORDER.filter((k) => present.has(k));
  }, [pool]);

  const filtered = useMemo(() => {
    if (!pool) return [];
    const list = searchVault(pool, query, kind);
    const sorted = [...list].sort((x, y) => {
      const cmp = String(x.archivedAt || "").localeCompare(String(y.archivedAt || ""));
      return oldestFirst ? cmp : -cmp;
    });
    return sorted;
  }, [pool, query, kind, oldestFirst]);

  // Reset the reveal window whenever the result set changes.
  useEffect(() => {
    setShown(PAGE);
  }, [query, kind, oldestFirst]);

  const visible = filtered.slice(0, shown);
  const more = filtered.length - visible.length;
  const total = VAULT_INDEX.total || pool?.length || 0;

  return (
    <div className="arcade-stage">
      <BackBar />
      <section className="arcade-vault">
        <header className="arcade-vault-head">
          <div className="arcade-vault-masthead">
            <img className="arcade-page-icon" src={vaultIcon} alt="" aria-hidden="true" />
            <div className="arcade-masthead-text">
              <h1 className="arcade-vault-title">THE VAULT</h1>
              <span className="arcade-vault-standing">the whole back catalogue of weird-web finds</span>
            </div>
          </div>
          <div className="arcade-vault-stat">
            <span className="arcade-vault-stat-num">{total.toLocaleString()}</span>
            <span className="arcade-vault-stat-label">finds and counting</span>
          </div>
          <p className="arcade-vault-lede">
            Everything the arcade has ever stumbled onto — forgotten sites, weird
            patents, wiki wormholes, durable curiosities. Not a feed. Just a
            library you wander.
          </p>
        </header>

        <div className="arcade-vault-controls">
          <input
            className="arcade-search-input arcade-vault-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search the vault…"
            aria-label="search the vault"
          />
          <div className="arcade-chips arcade-vault-chips">
            <button
              type="button"
              className={`arcade-chip${kind === "all" ? " is-active" : ""}`}
              onClick={() => setKind("all")}
            >
              all
            </button>
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className={`arcade-chip${kind === k ? " is-active" : ""}`}
                onClick={() => setKind(k)}
                title={KIND_LABEL[k]}
              >
                {KIND_CHIP[k]}
              </button>
            ))}
            <button
              type="button"
              className="arcade-chip arcade-vault-sort"
              onClick={() => setOldestFirst((v) => !v)}
              title="toggle order"
            >
              {oldestFirst ? "⏶ oldest" : "⏷ newest"}
            </button>
          </div>
        </div>

        {pool === null ? (
          <p className="arcade-vault-loading">cracking the vault…</p>
        ) : visible.length ? (
          <>
            <div className="arcade-grid arcade-vault-grid">
              {visible.map((a) => (
                <ArtifactCard key={a.id} artifact={a} />
              ))}
            </div>
            {more > 0 && (
              <div className="arcade-vault-more">
                <button
                  type="button"
                  className="arcade-stumble"
                  onClick={() => setShown((n) => n + PAGE)}
                >
                  load {Math.min(more, PAGE)} more ▾
                </button>
                <span className="arcade-vault-count">
                  showing {visible.length} of {filtered.length}
                </span>
              </div>
            )}
          </>
        ) : (
          <NedryGag message="Nothing in the vault matches that. Try a different word or clear the filter." />
        )}

        <p className="arcade-vault-foot">
          no algorithm. no feed. just everything we ever found. ✦
        </p>
      </section>
    </div>
  );
}
