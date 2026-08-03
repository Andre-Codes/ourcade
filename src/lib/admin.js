/* Who may open the dev console at #/admin.

   This list is a convenience gate: it hides the route and the write UI from
   everyone else. It is NOT the security boundary — a uid is an identifier, not
   a credential, so publishing it here grants nothing. The real gate is the
   matching isAdmin() helper in firestore.rules, which checks request.auth.uid
   against the same list and is enforced server-side on every write to
   live/content. Keep the two in sync; changing one without the other either
   locks you out of your own console or shows you a console that can't save. */

export const ADMIN_UIDS = ["it3XWpWHtTd65es3NJSRTLl5DZg1"];

export function isAdmin(uid) {
  return !!uid && ADMIN_UIDS.includes(uid);
}
