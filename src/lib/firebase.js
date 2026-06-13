/* ─────────────────────────────────────────────────────────────────────────
   FIREBASE — one place that initializes the app, Auth, and Firestore.

   The config below is NOT a secret: Firebase web config values are public
   identifiers that ship in every client bundle by design. Security comes from
   Firestore Security Rules (see firestore.rules) + App Check, NOT from hiding
   these. So they're committed directly (simpler + can't silently break the
   GitHub Pages build the way a missing CI env var would).

   Browser-only: never import this from the Node scripts (daily-check etc.).
   store.js reaches Firestore through a guarded dynamic import (src/lib/cloud.js)
   precisely so the pure data layer stays node-safe.
   ───────────────────────────────────────────────────────────────────────── */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDsdOIgrtvRpEPh7ppsp4_sYbOg_u52l-M",
  authDomain: "ourcade-69ac5.firebaseapp.com",
  projectId: "ourcade-69ac5",
  storageBucket: "ourcade-69ac5.firebasestorage.app",
  messagingSenderId: "658318785738",
  appId: "1:658318785738:web:81dc10270feb9a9b494833",
  measurementId: "G-PCKQFZ3VPG",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* App Check (abuse protection) — DEFERRED until just before public launch.
   It needs a reCAPTCHA v3 site key (Console → Build → App Check) and a debug
   token for localhost, so it's left off for now to keep dev unblocked. When
   ready, set RECAPTCHA_SITE_KEY and uncomment:

   import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
   const RECAPTCHA_SITE_KEY = "…";
   if (RECAPTCHA_SITE_KEY) {
     initializeAppCheck(app, {
       provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
       isTokenAutoRefreshEnabled: true,
     });
   }
*/
