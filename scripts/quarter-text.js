/* QUARTER TEXT — the NPC daily-puzzle texter.

   Byte Badger (an in-world NPC, number 555-0001) texts every claimed Ourcade
   member the day's Daily Quarter: the puzzle number, a no-spoiler nudge, and a
   link to play. This is what makes a brand-new account's phone feel alive on day
   one instead of empty — and a soft daily-return hook tied to the Quarter (B1).

   It's an ADMIN-SDK script (reuses scripts/lib/firebase-admin.js): the inbox
   create rule forbids forging `from`, so only the admin SDK (which bypasses
   rules) can deliver a message that appears to come from an NPC. Run on a daily
   schedule (GitHub Actions cron) AFTER local midnight in the audience's timezone,
   or manually:  node scripts/quarter-text.js

   The day's word/number come from the SAME src/games/quarter/logic.js the game
   uses, so the tease always matches the real puzzle. Delivery is idempotent: the
   inbox doc id is deterministic (`quarter-<day>`), so re-running a day just
   overwrites the same doc instead of spamming a second text.

   Flags:
     --day=YYYY-MM-DD   override "today" (QA / backfill). Defaults to local today.
     --dry              compute + log the message and recipients, write nothing.
     --limit=N          cap recipients (handy for a smoke test). */

import { getDb } from "./lib/firebase-admin.js";
import { answerFor, quarterNumber } from "../src/games/quarter/logic.js";
import { dayKey } from "../src/lib/daily.js";

// The NPC's stable identity. `from` is a sentinel uid that no real account can
// hold (real uids are Firebase-generated, never this literal), so it can't
// collide; the recipient's phone renders fromName/fromNumber, not `from`.
const NPC = {
  uid: "npc-byte-badger",
  name: "Byte Badger",
  number: "555-0001",
};

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const HAS = (name) => process.argv.includes(`--${name}`);

// A friendly, NON-SPOILING tease: Quarter #, the first letter, and a length
// reminder. Enough to bait curiosity without giving the word away.
function composeMessage(day) {
  const word = answerFor(day);
  const n = quarterNumber(day);
  const hint = word[0].toUpperCase();
  return (
    `🪙 Quarter #${n} is live! Today's word starts with “${hint}” ` +
    `(5 letters, 6 guesses). Spend your quarter: ` +
    `https://theourcade.com/#/play/quarter`
  );
}

async function main() {
  const day = arg("day") || dayKey(new Date());
  const limit = Number(arg("limit")) || 0;
  const dry = HAS("dry");

  const body = composeMessage(day);
  console.log(`Quarter text for ${day}:`);
  console.log(`  "${body}"`);

  const db = await getDb();
  if (!db) {
    console.log("No admin DB (FIREBASE_SERVICE_ACCOUNT unset) — nothing sent.");
    return;
  }

  const { FieldValue } = await import("firebase-admin/firestore");

  // Audience = claimed accounts (a public profile with an allocated number).
  let snap = await db.collection("profiles").get();
  let recipients = snap.docs.filter((d) => d.data()?.number);
  if (limit > 0) recipients = recipients.slice(0, limit);
  console.log(`Recipients: ${recipients.length} claimed account(s).`);

  if (dry) {
    console.log("[dry run] no messages written.");
    return;
  }

  // Deterministic per-day id → idempotent: re-running a day overwrites, never spams.
  const msgId = `quarter-${day}`;
  let delivered = 0;
  for (const d of recipients) {
    const toUid = d.id;
    try {
      await db
        .collection("messages").doc(toUid)
        .collection("inbox").doc(msgId)
        .set(
          {
            from: NPC.uid,
            to: toUid,
            fromNumber: NPC.number,
            fromName: NPC.name,
            body,
            ts: FieldValue.serverTimestamp(),
            read: false,
          },
          { merge: true }
        );
      delivered += 1;
    } catch (e) {
      console.warn(`  deliver to ${toUid} failed: ${e?.message || e}`);
    }
  }
  console.log(`Delivered ${delivered}/${recipients.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
