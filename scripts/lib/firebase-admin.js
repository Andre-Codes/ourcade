/* ============================================================
   FIREBASE-ADMIN — the backend ARCHIVE writer for the content
   generators. Appends every produced item to Firestore under
   archive/{type}/items/{id} (merge + runAt) so we keep a
   permanent "everything ever generated" store, separate from
   the committed src/data/generated/* the live site reads.

   SOFT-FAIL BY DESIGN: if FIREBASE_SERVICE_ACCOUNT is missing or
   any call throws, we log a warning and return — archiving must
   NEVER block a content commit. The admin SDK bypasses Firestore
   security rules, so archive/* needs no allow rule.

   Setup: Firebase console → Project settings → Service accounts →
   Generate new private key → set the JSON as FIREBASE_SERVICE_ACCOUNT
   (a GitHub Actions secret, and in a local .env for testing).
   ============================================================ */

let dbPromise = null; // null until first use; resolves to a Firestore or null

// Exported so other admin scripts (e.g. scripts/quarter-text.js) reuse the same
// soft-failing init + single app instance. Resolves to a Firestore handle, or
// null when FIREBASE_SERVICE_ACCOUNT is missing/invalid (callers should no-op).
export async function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      console.warn("archive: FIREBASE_SERVICE_ACCOUNT not set — skipping archive writes.");
      return null;
    }
    let creds;
    try {
      creds = JSON.parse(raw);
    } catch {
      console.warn("archive: FIREBASE_SERVICE_ACCOUNT is not valid JSON — skipping archive writes.");
      return null;
    }
    try {
      const { initializeApp, getApps, cert } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(creds) });
      return getFirestore(app);
    } catch (e) {
      console.warn(`archive: admin init failed (${e?.message || e}) — skipping archive writes.`);
      return null;
    }
  })();
  return dbPromise;
}

// Append one generated item to the permanent archive. Merge so re-runs update
// rather than wipe; stamp runAt with the server clock. Never throws.
export async function archiveItem(type, id, data) {
  if (!type || !id) return;
  try {
    const db = await getDb();
    if (!db) return;
    const { FieldValue } = await import("firebase-admin/firestore");
    await db
      .collection("archive")
      .doc(String(type))
      .collection("items")
      .doc(String(id))
      .set({ ...data, type: String(type), runAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn(`archive: write ${type}/${id} failed (${e?.message || e}).`);
  }
}

// Convenience: archive a whole batch of items for one type. Best-effort, serial
// to keep it gentle; soft-fails per item via archiveItem.
export async function archiveAll(type, items, idOf) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const id = (idOf ? idOf(item) : item?.id) || null;
    if (id) await archiveItem(type, id, item);
  }
}
