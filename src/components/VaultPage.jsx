import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadVault, VAULT_INDEX, searchVault } from "../data/vault.js";
import { useClaimed } from "../lib/AuthProvider.jsx";
import ArtifactCard, { KIND_LABEL } from "./ArtifactCard.jsx";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";
import vaultIcon from "../assets/page-icons/vault.webp";
import badgerOfficer from "../assets/badger-officer.webp";

/* /vault — THE VAULT. The whole back catalogue of the arcade's timeless internet
   finds (stumble + weird + curiosities, ever). The daily site only ever shows you
   "today"; this is the depth — a wanderable library, not a feed. Finite, no
   algorithm: search + a kind filter + load-more, newest-first by default. The
   corpus is a build-time snapshot of the Firestore archive (see vault.js /
   scripts/snapshot-archive.js), lazy-loaded as its own chunk.

   MEMBERS GET THE KEY. Everyone sees the door and the newest FREE_PAGE finds —
   the depth (search, kind filters, sort, everything past the free slice) wants a
   claimed account. This is a PRODUCT gate, not access control: generated/vault.js
   ships as a public static chunk, so it buys a reason to claim an account and
   nothing more. Deliberately still open to everyone: Deep Stumble (stumble.js)
   and getVaultGemOfTheDay() — the daily taste that makes the door worth opening. */

const PAGE = 24; // how many cards to reveal per "load more"
const FREE_PAGE = 24; // how much of the vault an unclaimed visitor gets to browse

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
  const { claimed, ready } = useClaimed();
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

  // Unclaimed visitors get the newest FREE_PAGE and no reveal button. The
  // controls aren't rendered for them either, so query/kind/sort sit at their
  // defaults and `filtered` is simply the whole corpus, newest first.
  const visible = filtered.slice(0, claimed ? shown : FREE_PAGE);
  const more = filtered.length - visible.length;
  // The eager index gives an instant count before the lazy corpus arrives; once
  // it has, prefer its length — that's the one the admin overlay has filtered,
  // so a hidden find doesn't leave the headline stat one too high.
  const total = pool ? pool.length : VAULT_INDEX.total || 0;

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

        {claimed ? (
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
        ) : (
          <p className="arcade-vault-locked-strip">
            🔒 search, filters &amp; the full depth — members only
          </p>
        )}

        {/* `ready` guards the gate, not just the data: isAnonymous defaults to
            true until auth settles, so rendering off `claimed` alone would flash
            the locked state at members on every reload. */}
        {pool === null || !ready ? (
          <p className="arcade-vault-loading">cracking the vault…</p>
        ) : visible.length ? (
          <>
            <div className="arcade-grid arcade-vault-grid">
              {visible.map((a) => (
                <ArtifactCard key={a.id} artifact={a} />
              ))}
            </div>
            {more > 0 &&
              (claimed ? (
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
              ) : (
                <section className="arcade-card-panel arcade-submit-gate arcade-vault-gate">
                  <img
                    className="arcade-submit-officer"
                    src={badgerOfficer}
                    alt=""
                    aria-hidden="true"
                  />
                  <p className="arcade-account-blurb">
                    <strong>{more.toLocaleString()} more finds</strong> are behind the
                    vault door — plus search and filters. Claim an account and the
                    key's yours.
                  </p>
                  <Link to="/me" className="arcade-stumble arcade-submit-cta">
                    Claim / Log in →
                  </Link>
                </section>
              ))}
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
