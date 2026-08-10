// Firebase initialization.
//
// Get these values from: Firebase console -> Project settings (gear icon)
// -> General tab -> "Your apps" -> select your web app -> SDK setup and
// configuration -> Config. See README.md for the full setup walkthrough.
//
// App Check (reCAPTCHA v3) is how "reCAPTCHA protection" is implemented
// here: rather than a decorative checkbox with no way to verify it (this
// project has no backend server to check a secret key against), App Check
// attaches a Firebase-verified token to every Auth/Firestore/Storage call.
// Requests without a valid token are rejected by Firebase's own backend —
// see README for how to get a site key and turn on enforcement.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQ6sCHyz2z6nk69tDCksBnHg4KJ0DqZRk",
  authDomain: "moussaonlinemarket.firebaseapp.com",
  projectId: "moussaonlinemarket",
  storageBucket: "moussaonlinemarket.firebasestorage.app",
  messagingSenderId: "226336134272",
  appId: "1:226336134272:web:37436457c1095432c0c265",
  measurementId: "G-8M45613MKC"
};

// From the reCAPTCHA admin console (v3, "score based") — see README.
const RECAPTCHA_V3_SITE_KEY = "6LdsnH4tAAAAAJyRTR1zkHONVSpawYvZA0jJPh_C";

export const app = initializeApp(firebaseConfig);

export const appCheck = RECAPTCHA_V3_SITE_KEY.startsWith("YOUR_")
  ? null // not configured yet — App Check stays off rather than breaking the app
  : initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

