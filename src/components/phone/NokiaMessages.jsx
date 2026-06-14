import { useEffect, useMemo, useState } from "react";
import { usePhone } from "../../lib/PhoneProvider.jsx";

/* NokiaMessages — the phone's MESSAGES app, rebuilt as a React overlay that
   reads the live PhoneProvider state DIRECTLY. It renders on top of the Nokia
   emulator iframe on /phone (the iframe still owns Snake/dialer/composer/etc.);
   the iframe's MENU → MESSAGES posts a one-way `nopia:openmessages` and PhonePage
   flips this overlay on.

   The whole point of the refactor: messages are Firebase-owned end-to-end here.
   There is NO second copy of the inbox/sent data and NO postMessage relay of
   message bodies — so the old "messages vanish from the phone UI" bug (a stale
   relayed cache wiped on identity churn) is structurally impossible. Inbox/sent
   come from usePhone(); every action (send/markRead/addContact/clear) is a
   provider call that writes Firestore.

   Styled to feel like the Nokia LCD (pixel font, green-on-black, soft-key bar)
   without trying to be pixel-identical to the canvas glyphs. */

// Friendly label for a row: saved contact name → number → name the message
// carries → fallback. Mirrors PhoneChrome.senderLabel but works for both folders.
function rowLabel(contacts, num, fallbackName) {
  const c = contacts.find((x) => x.number === num);
  return (c && c.name) || fallbackName || num || "SOMEONE";
}

export default function NokiaMessages({ onClose }) {
  const phone = usePhone() || {};
  const {
    inbox = [],
    sent = [],
    contacts = [],
    unreadCount = 0,
    relaySend,
    relayAddContact,
    clearMessages,
    markRead,
  } = phone;

  // Simple screen stack: top of `stack` is the visible screen. Back pops; an
  // empty stack closes the overlay (returns to the emulator).
  const [stack, setStack] = useState([{ id: "menu" }]);
  const screen = stack[stack.length - 1];
  const push = (s) => setStack((st) => [...st, s]);
  // Back pops a screen; at the root it closes the overlay (back to the emulator).
  const back = () => {
    if (stack.length > 1) setStack((st) => st.slice(0, -1));
    else onClose?.();
  };
  const toMenu = () => setStack([{ id: "menu" }]);

  // Toast for action results (SENT / NOT DELIVERED / SAVED…).
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="nokia-msgs" role="dialog" aria-label="Messages">
      <div className="nokia-msgs-status">
        <span>OURCADE</span>
        <span>MESSAGES</span>
      </div>

      <div className="nokia-msgs-body">
        {screen.id === "menu" && (
          <MenuScreen
            unreadCount={unreadCount}
            onInbox={() => push({ id: "inbox" })}
            onSent={() => push({ id: "sent" })}
            onCompose={() => push({ id: "compose", to: "" })}
            onNames={() => push({ id: "names" })}
            onClear={() => push({ id: "clear" })}
          />
        )}

        {(screen.id === "inbox" || screen.id === "sent") && (
          <FolderScreen
            folder={screen.id}
            inbox={inbox}
            sent={sent}
            contacts={contacts}
            onOpen={(msg) => {
              if (screen.id === "inbox" && !msg.read) markRead?.(msg.id);
              push({ id: "view", folder: screen.id, msg });
            }}
          />
        )}

        {screen.id === "view" && (
          <ViewScreen
            folder={screen.folder}
            msg={screen.msg}
            contacts={contacts}
          />
        )}

        {screen.id === "compose" && (
          <ComposeScreen
            initialTo={screen.to}
            contacts={contacts}
            onSend={async (to, body) => {
              const r = (await relaySend?.(to, body)) || {};
              setToast(r.error || (r.ok ? "MESSAGE SENT" : "NOT DELIVERED"));
              if (r.ok) toMenu();
            }}
          />
        )}

        {screen.id === "names" && (
          <NamesScreen
            contacts={contacts}
            onAdd={() => push({ id: "addcontact" })}
            onText={(number) => push({ id: "compose", to: number })}
          />
        )}

        {screen.id === "addcontact" && (
          <AddContactScreen
            onSave={async (name, number) => {
              const r = (await relayAddContact?.(name, number)) || {};
              setToast(r.ok ? "SAVED" : r.error || "NO SUCH NUMBER");
              if (r.ok) back();
            }}
          />
        )}

        {screen.id === "clear" && (
          <ConfirmScreen
            prompt="CLEAR ALL MESSAGES?"
            onYes={async () => {
              const r = (await clearMessages?.()) || {};
              setToast(r.ok ? "CLEARED" : "FAILED");
              toMenu();
            }}
            onNo={back}
          />
        )}
      </div>

      {toast && <div className="nokia-msgs-toast">{toast}</div>}

      <div className="nokia-msgs-soft">
        <button type="button" className="nokia-msgs-softkey" onClick={back}>
          {stack.length > 1 ? "Back" : "Exit"}
        </button>
        {screen.id === "view" && screen.folder === "inbox" && (
          <button
            type="button"
            className="nokia-msgs-softkey"
            onClick={() =>
              push({ id: "compose", to: screen.msg.fromNumber || screen.msg.from })
            }
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}

function MenuScreen({ unreadCount, onInbox, onSent, onCompose, onNames, onClear }) {
  const items = [
    { label: `INBOX${unreadCount ? ` (${unreadCount})` : ""}`, run: onInbox },
    { label: "WRITE MESSAGE", run: onCompose },
    { label: "SENT", run: onSent },
    { label: "NAMES", run: onNames },
    { label: "CLEAR MESSAGES", run: onClear },
  ];
  return <List items={items} />;
}

function FolderScreen({ folder, inbox, sent, contacts, onOpen }) {
  const rows = folder === "inbox" ? inbox : sent;
  if (!rows.length) return <Empty>(EMPTY)</Empty>;
  const items = rows.map((m) => {
    const num = folder === "inbox" ? m.fromNumber || m.from : m.toNumber || m.to;
    const name = folder === "inbox" ? m.fromName : m.toName;
    const label = `${rowLabel(contacts, num, name)}: ${String(m.body || "").slice(0, 12)}`;
    return { label: label.toUpperCase(), run: () => onOpen(m), unread: folder === "inbox" && !m.read };
  });
  return <List items={items} />;
}

function ViewScreen({ folder, msg, contacts }) {
  const num = folder === "inbox" ? msg.fromNumber || msg.from : msg.toNumber || msg.to;
  const name = folder === "inbox" ? msg.fromName : msg.toName;
  const who = `${folder === "inbox" ? "FROM " : "TO "}${rowLabel(contacts, num, name)}`;
  return (
    <div className="nokia-msgs-view">
      <div className="nokia-msgs-view-who">{who.toUpperCase()}</div>
      <div className="nokia-msgs-view-body">{msg.body}</div>
    </div>
  );
}

function ComposeScreen({ initialTo, contacts, onSend }) {
  const [to, setTo] = useState(initialTo || "");
  const [body, setBody] = useState("");
  const canSend = to.trim() && body.trim();
  return (
    <div className="nokia-msgs-compose">
      <label className="nokia-msgs-field">
        <span>TO</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="555-0000 or @name"
          inputMode="text"
          autoComplete="off"
        />
      </label>
      {contacts.length > 0 && (
        <select
          className="nokia-msgs-pick"
          value=""
          onChange={(e) => e.target.value && setTo(e.target.value)}
        >
          <option value="">— PICK A NAME —</option>
          {contacts.map((c) => (
            <option key={c.number} value={c.number}>
              {c.name} {c.number}
            </option>
          ))}
        </select>
      )}
      <textarea
        className="nokia-msgs-text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="MESSAGE…"
        maxLength={320}
        rows={4}
      />
      <button
        type="button"
        className="nokia-msgs-send"
        disabled={!canSend}
        onClick={() => onSend(to.trim(), body.trim())}
      >
        SEND
      </button>
    </div>
  );
}

function NamesScreen({ contacts, onAdd, onText }) {
  const items = useMemo(
    () => [
      { label: "+ ADD CONTACT", run: onAdd },
      ...contacts.map((c) => ({
        label: `${c.name} ${c.number}`.toUpperCase(),
        run: () => onText(c.number),
      })),
    ],
    [contacts, onAdd, onText]
  );
  return <List items={items} />;
}

function AddContactScreen({ onSave }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const canSave = name.trim() && number.trim();
  return (
    <div className="nokia-msgs-compose">
      <label className="nokia-msgs-field">
        <span>NUMBER</span>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="555-0000"
          inputMode="text"
          autoComplete="off"
        />
      </label>
      <label className="nokia-msgs-field">
        <span>NAME</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="NAME"
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        className="nokia-msgs-send"
        disabled={!canSave}
        onClick={() => onSave(name.trim(), number.trim())}
      >
        SAVE
      </button>
    </div>
  );
}

function ConfirmScreen({ prompt, onYes, onNo }) {
  return (
    <div className="nokia-msgs-confirm">
      <p>{prompt}</p>
      <div className="nokia-msgs-confirm-row">
        <button type="button" className="nokia-msgs-send" onClick={onYes}>
          YES
        </button>
        <button type="button" className="nokia-msgs-send" onClick={onNo}>
          NO
        </button>
      </div>
    </div>
  );
}

function List({ items }) {
  return (
    <ul className="nokia-msgs-list">
      {items.map((it, i) => (
        <li key={i}>
          <button type="button" className="nokia-msgs-row" onClick={it.run}>
            <span className="nokia-msgs-row-caret">›</span>
            <span className="nokia-msgs-row-label">{it.label}</span>
            {it.unread && <span className="nokia-msgs-row-dot" aria-label="unread" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }) {
  return <div className="nokia-msgs-empty">{children}</div>;
}
