/* ─────────────────────────────────────────────────────────────────────────
   #/admin — the dev console.

   A phone-sized editor for the dynamic content families: add a Stumble find,
   fix a dead link, swap the PING game, pin a news line to a date window.
   Writes land in Firestore live/content and show up site-wide within seconds,
   with no rebuild (see src/data/live.js for the merge, and scripts/snapshot-live.js
   for the nightly bake back into the repo).

   Every form on this page is generated from the field tables in
   src/data/liveSchema.js — adding a field there adds it here.

   The ADMIN_UIDS check below only hides the UI. The real gate is isAdmin() in
   firestore.rules, so a non-admin who reaches this route can look at the lists
   (all of this content is public anyway) but every write is refused server-side.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthProvider.jsx";
import { isAdmin } from "../lib/admin.js";
import { readLiveContent, writeLiveContent } from "../lib/cloud.js";
import { LIVE_TYPES, setLive } from "../data/live.js";
import { LIVE_FORMS, visibleFields, validateItem, buildItem } from "../data/liveSchema.js";
import { STUMBLE_BASE } from "../data/stumble.js";
import { loadVaultRaw } from "../data/vault.js";
import { WEIRD, WEIRD_NIGHT } from "../data/weird.js";
import { CURIOSITIES } from "../data/curiosities.js";
import { NEWS_BASE } from "../data/flavor.js";
import { FEATURED } from "../data/manual/featured.js";
import { MOVIES } from "../data/manual/movies.js";
import { SCHEDULE_BASE } from "../data/manual/schedule.js";
import { todayKey } from "../lib/daily.js";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

// The committed pool behind each family, pre-overlay. News is a list of plain
// strings; everything else is { id, … } objects.
// `vault` is absent on purpose — it's an 82 KB lazy chunk, so it's fetched by
// the component only when that tab is opened (see vaultBase below).
const BASE = {
  stumble: () => STUMBLE_BASE,
  weird: () => WEIRD,
  weirdNight: () => WEIRD_NIGHT,
  curiosities: () => CURIOSITIES,
  featured: () => FEATURED,
  movies: () => MOVIES,
  // A baked news line is a bare string — its own text is the only id it has.
  news: () => NEWS_BASE.map((text) => ({ id: text, text })),
  schedule: () => SCHEDULE_BASE,
};

// A pseudo-type for the reference tab — it has no pool and no form.
const HELP = "help";

function layerOf(overlay, type) {
  const l = overlay?.[type];
  return {
    adds: Array.isArray(l?.adds) ? l.adds : [],
    patches: l?.patches && typeof l.patches === "object" ? l.patches : {},
    hides: Array.isArray(l?.hides) ? l.hides : [],
  };
}

// One-line summary for a list row.
function rowText(type, item) {
  if (type === "news") return item.text;
  if (type === "movies") return `${item.stinger === "yes" ? "✅" : "🚫"} ${item.title}`;
  if (type === "schedule") {
    const when = item.until ? `→ ${item.until}` : item.days ? `for ${item.days}d` : "open-ended";
    return `${item.mode?.toUpperCase()} ${item.type} · ${item.from} ${when} — ${item.title || item.text || ""}`;
  }
  return item.title;
}

/* ── one form field, rendered from its schema entry ──────────────────────── */
function FieldInput({ field, value, error, onChange }) {
  const v = value ?? "";
  const set = (e) => onChange(field.key, e.target.value);
  const cls = `arcade-field-input${error ? " is-bad" : ""}`;

  let control;
  if (field.type === "textarea") {
    control = <textarea className={cls} rows={3} value={v} onChange={set} placeholder={field.placeholder} />;
  } else if (field.type === "select") {
    control = (
      <select className={cls} value={v} onChange={set}>
        {field.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  } else if (field.type === "color") {
    control = (
      <span className="arcade-admin-color">
        <input className={cls} value={v} onChange={set} placeholder={field.placeholder} inputMode="text" />
        <span className="arcade-admin-swatch" style={{ background: v || "transparent" }} aria-hidden="true" />
      </span>
    );
  } else {
    control = (
      <input
        className={cls}
        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        inputMode={field.type === "url" ? "url" : undefined}
        value={v}
        onChange={set}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <label className="arcade-field">
      <span className="arcade-field-label">
        {field.label}
        {field.required ? " *" : ""}
      </span>
      {control}
      {error ? <span className="arcade-admin-err">{error}</span> : null}
      {!error && field.hint ? <span className="arcade-admin-hint">{field.hint}</span> : null}
    </label>
  );
}

/* ── add / edit form ─────────────────────────────────────────────────────── */
function ItemForm({ type, initial, takenIds, selfId, note, busy, onCancel, onSave }) {
  const [values, setValues] = useState(() => {
    const seed = { ...(initial || {}) };
    for (const f of LIVE_FORMS[type].fields) {
      if (seed[f.key] == null && f.default) seed[f.key] = f.default;
    }
    return seed;
  });
  const [errors, setErrors] = useState({});

  const onChange = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const submit = (e) => {
    e.preventDefault();
    const errs = validateItem(type, values, takenIds, selfId);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(buildItem(type, values, selfId));
  };

  return (
    <form className="arcade-admin-form" onSubmit={submit}>
      {note ? <p className="arcade-admin-note">{note}</p> : null}
      {visibleFields(type, values).map((f) => (
        <FieldInput key={f.key} field={f} value={values[f.key]} error={errors[f.key]} onChange={onChange} />
      ))}
      <div className="arcade-admin-formbar">
        <button type="button" className="arcade-admin-btn" onClick={onCancel} disabled={busy}>
          CANCEL
        </button>
        <button type="submit" className="arcade-admin-btn is-go" disabled={busy}>
          {busy ? "SAVING…" : "SAVE"}
        </button>
      </div>
    </form>
  );
}

/* ── the ❓ HELP tab ──────────────────────────────────────────────────────
   Quick reference for the stuff that isn't obvious from the forms: what each
   action actually does to a repo item vs. a console item, and when to stop
   using this page and go edit the real file instead. */
function HelpGuide() {
  return (
    <div className="arcade-admin-help">
      <h2>How this works</h2>
      <p>
        You write to Firestore; every visitor merges that over the pools baked into the site.
        Edits are live in <b>seconds, with no rebuild</b>. A nightly job commits them back into
        the repo, so nothing here is trapped in a database.
      </p>

      <h2>What each button does</h2>
      <p>
        Rows are tagged <span className="arcade-admin-chip is-baked">repo</span> (written in a
        file) or <span className="arcade-admin-chip is-live">live</span> (added here).
      </p>
      <div className="arcade-admin-tablewrap">
        <table>
          <thead>
            <tr><th /><th>repo row</th><th>live row</th></tr>
          </thead>
          <tbody>
            <tr>
              <th>EDIT</th>
              <td>Saves an <b>override</b> — the file is untouched. Row gets an{" "}
                <span className="arcade-admin-chip is-patched">override</span> chip.</td>
              <td>Edits it in place.</td>
            </tr>
            <tr>
              <th>HIDE</th>
              <td colSpan={2}>Drops it from the pool. Reversible — the button becomes RESTORE.</td>
            </tr>
            <tr>
              <th>RESET</th>
              <td>Throws the override away, back to what the file says.</td>
              <td>—</td>
            </tr>
            <tr>
              <th>DELETE</th>
              <td>Not offered — use HIDE.</td>
              <td>Gone for good.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Console, or edit the file?</h2>
      <ul>
        <li><b>Use the console</b> when you're not at a computer, when something needs fixing
          <i> now</i> (dead link, bad blurb), or for anything short-lived.</li>
        <li><b>Edit <code>src/data/manual/content.js</code></b> for real, permanent additions —
          it's easier to write ten items in a file than ten times in a form, and it's the
          canonical place people will look.</li>
        <li>An <b>override is a stopgap.</b> It only stores the fields you changed, so fixing
          the file properly later still shows through for everything else. Then RESET the
          override.</li>
        <li>Both layers merge into the same pool. Neither wins; adding here doesn't disable
          anything there.</li>
      </ul>

      <h2>Per-tab notes</h2>
      <ul>
        <li><b>🎲 Stumble</b> — <code>era</code> drives the invisible 40/40/20 draw and is never
          shown. Flash artifacts aren't listed: they're generated from the archive.org pool.</li>
        <li><b>🗄️ Vault</b> — the archived corpus behind <code>/vault</code>, the gem of the day,
          and Stumble's low-weight “deep tail”. It's the oldest material on the site, so it's
          where dead links collect — fix or hide them here. <b>No ADD button:</b> new finds go in
          🎲 Stumble, since anything added here would be wiped by the next archive snapshot.</li>
        <li><b>🔍 Weird / 🌙 Night</b> — Weird rotates every ~3h through the day. Night only
          appears after 22:00 and is never touched by the scheduler. Keep those good.</li>
        <li><b>★ PING</b> — one entry per <i>week</i>, and the week rolls over on a{" "}
          <b>Thursday</b>, not seven days from when you added it. The pick is date-seeded, so a
          new game takes whichever slot the shuffle gives it — it may show today, or wait a few
          weeks. Repo entries use optimized art; entries added here need a full{" "}
          <code>image url</code> since they can't run the asset build.</li>
        <li><b>🎬 Credits</b> — no rotation: every entry shows on the homepage, in list order.
          Delete one the week its film leaves theaters, or the card just grows.</li>
        <li><b>📰 News</b> — the odd one out. Baked lines are bare strings with no id, so EDIT
          <i> hides the original and adds your version</i>. Same result, and the original comes
          back if you RESTORE it.</li>
        <li><b>🗓️ Schedule</b> — <code>pin</code> forces the slot for the whole window;{" "}
          <code>pool</code> just gives it a chance to appear. Set <code>until</code> <i>or</i>{" "}
          <code>days</code>, never both. Blank both = runs forever.</li>
      </ul>

      <h2>Searching</h2>
      <p>
        The box above each list matches <b>any</b> field — title, blurb, url, id, kind, era. Words
        are AND-ed, so <code>rain live</code> narrows twice. The status words work as filters
        too: <code>hidden</code>, <code>override</code>, <code>live</code>, <code>repo</code>.
      </p>

      <h2>Worth knowing</h2>
      <ul>
        <li>Adding items lengthens a pool, which reshuffles what the rotation surfaces today.
          Normal — a hand edit does the same thing.</li>
        <li>Generated content (the AI batches) can be hidden or overridden from here, but the
          next generator run rewrites the underlying file.</li>
        <li>Preview any date by adding <code>?day=YYYY-MM-DD</code> to the homepage URL — the
          fastest way to check a scheduled pin before it goes live.</li>
        <li>Nothing here can break a game. This page only touches content pools.</li>
      </ul>
    </div>
  );
}

/* ── the page ────────────────────────────────────────────────────────────── */
export default function AdminPage() {
  const { uid, ready, isAnonymous } = useAuth();
  const admin = isAdmin(uid);

  const [type, setType] = useState(LIVE_TYPES[0]);
  const [overlay, setOverlay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null); // { id } | { add: true }
  const [confirm, setConfirm] = useState(null);
  const [q, setQ] = useState("");
  const [vaultBase, setVaultBase] = useState(null); // lazy — only when 🗄️ is opened

  useEffect(() => {
    if (!ready || !admin) return;
    let alive = true;
    readLiveContent()
      .then((d) => alive && setOverlay(d || {}))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ready, admin]);

  // Pull the Vault chunk the first time its tab is opened, never before.
  useEffect(() => {
    if (type !== "vault" || vaultBase) return;
    let alive = true;
    loadVaultRaw().then((items) => alive && setVaultBase(items));
    return () => {
      alive = false;
    };
  }, [type, vaultBase]);

  const layer = layerOf(overlay, type);

  // The committed pool behind the current tab, pre-overlay.
  const baseItems = type === "vault" ? vaultBase : BASE[type] ? BASE[type]() : null;

  // Baked rows first (matching the pool order the site rotates through), then
  // console-added ones. A live add with a baked id shadows it, same as applyLive.
  const rows = useMemo(() => {
    if (!baseItems) return []; // ❓ HELP has no pool; 🗄️ VAULT is still fetching
    const addIds = new Set(layer.adds.map((a) => a.id));
    const baked = baseItems
      .filter((it) => !addIds.has(it.id))
      .map((it) => ({
        item: layer.patches[it.id] ? { ...it, ...layer.patches[it.id] } : it,
        origin: "baked",
        patched: !!layer.patches[it.id],
        hidden: layer.hides.includes(it.id),
      }));
    const live = layer.adds.map((it) => ({
      item: it,
      origin: "live",
      patched: false,
      hidden: layer.hides.includes(it.id),
    }));
    return [...baked, ...live];
  }, [baseItems, layer]);

  const takenIds = useMemo(() => rows.map((r) => r.item.id), [rows]);

  /* Search. Every string value on the item is searchable (title, blurb, url,
     id, kind, era, the news text…), plus the row's own status words — so
     "hidden", "override", "live" and "repo" work as filters without needing a
     separate control. Terms are AND-ed, so "rain live" narrows twice. */
  const visibleRows = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return rows;
    return rows.filter((r) => {
      const hay = [
        ...Object.values(r.item).filter((v) => typeof v === "string"),
        r.origin === "live" ? "live" : "repo",
        r.patched ? "override" : "",
        r.hidden ? "hidden" : "",
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, q]);

  // The row being edited, if any — declared here because the save handlers below
  // branch on where it came from (repo vs. console).
  const editRow = editing?.id ? rows.find((r) => r.item.id === editing.id) : null;

  async function save(nextLayer, msg) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await writeLiveContent(type, nextLayer);
      const next = { ...(overlay || {}), [type]: nextLayer };
      setOverlay(next);
      setLive(next); // the rest of the site updates without a reload
      setNotice(msg);
      setEditing(null);
    } catch (e) {
      setError(
        e?.code === "permission-denied"
          ? "Permission denied. Publish firestore.rules in the Firebase console — it must include your uid in isAdmin()."
          : e?.message || "Save failed."
      );
    } finally {
      setBusy(false);
    }
  }

  // Saving an add or an edit: replace-or-append in `adds`, and always clear any
  // tombstone for that id (otherwise re-adding something you deleted stays hidden).
  const onSaveNew = (item) =>
    save(
      {
        ...layer,
        adds: layer.adds.some((a) => a.id === item.id)
          ? layer.adds.map((a) => (a.id === item.id ? item : a))
          : [...layer.adds, item],
        hides: layer.hides.filter((h) => h !== item.id),
      },
      "Saved."
    );

  /* Editing a BAKED item stores an override instead — the repo file stays put.
     Only the fields that actually CHANGED go into the patch: storing a full
     copy would silently freeze the item, so a later edit to the real file
     (or a regenerated blurb) would never show through. Fields the form
     cleared are blanked explicitly, since a shallow merge can't unset a key. */
  const onSavePatch = (item) => {
    const base = (baseItems || []).find((b) => b.id === item.id) || {};
    const patch = {};
    for (const [k, v] of Object.entries(item)) {
      if (k !== "id" && v !== base[k]) patch[k] = v;
    }
    for (const k of Object.keys(base)) {
      if (k !== "id" && !(k in item) && base[k]) patch[k] = "";
    }
    if (!Object.keys(patch).length) {
      setEditing(null);
      setNotice("No changes.");
      return;
    }
    return save({ ...layer, patches: { ...layer.patches, [item.id]: patch } }, "Override saved.");
  };

  /* Site News has no patch path — applyLiveNews() only understands adds and
     hides, because a baked news item is a bare string with no id to key on.
     So "editing" one means: hide the original line, add the new text as a live
     one. (This is why the form below withholds selfId for that case — the new
     line needs its own derived id, not the old line's text.) */
  const onReplaceNews = (item) =>
    save(
      {
        ...layer,
        adds: [...layer.adds.filter((a) => a.id !== item.id), item],
        hides: [...layer.hides.filter((h) => h !== editRow.item.id), editRow.item.id],
      },
      "Replaced."
    );

  const toggleHide = (row) =>
    save(
      {
        ...layer,
        hides: row.hidden
          ? layer.hides.filter((h) => h !== row.item.id)
          : [...layer.hides, row.item.id],
      },
      row.hidden ? "Restored." : "Hidden."
    );

  const resetPatch = (row) => {
    const patches = { ...layer.patches };
    delete patches[row.item.id];
    return save({ ...layer, patches }, "Override removed.");
  };

  // Delete a console-added item: drop it AND tombstone the id, so it can't come
  // back from the baked seed in generated/live.js before the next snapshot.
  const doDelete = (row) =>
    save(
      {
        ...layer,
        adds: layer.adds.filter((a) => a.id !== row.item.id),
        hides: [...layer.hides.filter((h) => h !== row.item.id), row.item.id],
      },
      "Deleted."
    );

  if (!ready) {
    return (
      <div className="arcade-stage">
        <BackBar to="/" label="BACK TO OURCADE" />
        <p className="arcade-loading">connecting…</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="arcade-stage">
        <BackBar to="/" label="BACK TO OURCADE" />
        <NedryGag
          message={
            isAnonymous
              ? "This one's staff-only. Log in on /me if that's you."
              : "This account isn't on the console's list."
          }
        />
      </div>
    );
  }

  const form = LIVE_FORMS[type];

  // Three ways to save, picked from where the row came from:
  //   live row  → edit it in place
  //   news row  → replace it (hide + add), because news has no patch path
  //   repo row  → store an override
  const baked = editRow?.origin === "baked";
  const replacingNews = baked && type === "news";
  const onSave = !editRow ? onSaveNew : replacingNews ? onReplaceNews : baked ? onSavePatch : onSaveNew;
  const formNote = replacingNews
    ? "This line lives in the repo. Saving hides the original and adds your version as a live line."
    : baked
      ? `This one is baked into the repo. Saving stores an override for ${editRow.item.id} — the file itself is untouched.`
      : null;

  return (
    <div className="arcade-stage arcade-admin">
      <BackBar to="/" label="BACK TO OURCADE" />

      <header className="arcade-admin-head">
        <h1 className="arcade-admin-title">🛠️ DEV CONSOLE</h1>
        <p className="arcade-admin-blurb">
          Edits go live in seconds — no rebuild. A nightly job bakes them into the repo.
        </p>
      </header>

      <div className="arcade-admin-tabs" role="tablist">
        {[...LIVE_TYPES, HELP].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === type}
            className={`arcade-admin-tab${t === type ? " is-active" : ""}`}
            onClick={() => {
              setType(t);
              setEditing(null);
              setError("");
              setNotice("");
              setQ("");
            }}
          >
            {t === HELP ? "❓ HELP" : `${LIVE_FORMS[t].emoji} ${LIVE_FORMS[t].tab}`}
          </button>
        ))}
      </div>

      {form ? <p className="arcade-admin-blurb">{form.blurb}</p> : null}

      {error ? <p className="arcade-account-error">{error}</p> : null}
      {notice ? <p className="arcade-account-notice">{notice}</p> : null}

      {type === HELP ? (
        <HelpGuide />
      ) : loading ? (
        <p className="arcade-loading">loading content…</p>
      ) : editing ? (
        <ItemForm
          type={type}
          initial={editRow ? editRow.item : null}
          takenIds={takenIds}
          // A replaced news line gets a FRESH id derived from its new text —
          // the old "id" is the original string, which we're hiding.
          selfId={editRow && !replacingNews ? editRow.item.id : null}
          note={formNote}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={onSave}
        />
      ) : !baseItems ? (
        <p className="arcade-loading">loading the vault…</p>
      ) : (
        <>
          {/* The Vault is a snapshot of the archive — correcting and pruning it
              is the point; adding here would be wiped by snapshot:archive. */}
          {form.noAdd ? null : (
            <button className="arcade-admin-btn is-go arcade-admin-add" onClick={() => setEditing({ add: true })}>
              + ADD {form.noun.toUpperCase()}
            </button>
          )}

          <div className="arcade-admin-search">
            <input
              className="arcade-field-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`search ${rows.length} ${form.plural}…`}
              aria-label={`Search ${form.tab}`}
            />
            {q ? (
              <button type="button" className="arcade-admin-btn" onClick={() => setQ("")}>
                CLEAR
              </button>
            ) : null}
          </div>

          <ul className="arcade-admin-list">
            {visibleRows.map((row) => (
              <li key={row.item.id} className={`arcade-admin-row${row.hidden ? " is-hidden" : ""}`}>
                <div className="arcade-admin-rowtop">
                  <span className={`arcade-admin-chip is-${row.origin}`}>
                    {row.origin === "live" ? "live" : "repo"}
                  </span>
                  {row.patched ? <span className="arcade-admin-chip is-patched">override</span> : null}
                  {row.hidden ? <span className="arcade-admin-chip is-off">hidden</span> : null}
                </div>
                <p className="arcade-admin-rowtext">{rowText(type, row.item)}</p>
                {row.item.url ? <span className="arcade-admin-rowurl">{row.item.url}</span> : null}
                <div className="arcade-admin-rowbar">
                  <button className="arcade-admin-btn" disabled={busy} onClick={() => setEditing({ id: row.item.id })}>
                    EDIT
                  </button>
                  <button className="arcade-admin-btn" disabled={busy} onClick={() => toggleHide(row)}>
                    {row.hidden ? "RESTORE" : "HIDE"}
                  </button>
                  {row.patched ? (
                    <button className="arcade-admin-btn" disabled={busy} onClick={() => resetPatch(row)}>
                      RESET
                    </button>
                  ) : null}
                  {row.origin === "live" ? (
                    <button className="arcade-admin-btn is-bad" disabled={busy} onClick={() => setConfirm(row)}>
                      DELETE
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {q && !visibleRows.length ? (
            <p className="arcade-admin-foot">
              Nothing matches “{q}”. Try fewer words, or a url fragment.
            </p>
          ) : null}

          <p className="arcade-admin-foot">
            {q ? `${visibleRows.length} of ${rows.length} shown` : `${rows.length} in the pool`} ·
            preview a date with <code>#/?day={todayKey()}</code> ·{" "}
            <button type="button" className="arcade-account-link" onClick={() => setType(HELP)}>
              what do these buttons do?
            </button>
          </p>
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Delete this?"
        message={confirm ? rowText(type, confirm.item) : ""}
        confirmLabel="DELETE"
        cancelLabel="KEEP"
        onConfirm={() => {
          const row = confirm;
          setConfirm(null);
          doDelete(row);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
