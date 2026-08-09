// Firebase initialization.
//
// Get these values from: Firebase console -> Project settings (gear icon)
// -> General tab -> "Your apps" -> select your web app -> SDK setup and
// configuration -> Config. See README.md for the full setup walkthrough.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQ6sCHyz2z6nk69tDCksBnHg4KJ0DqZRk",
  authDomain: "moussaonlinemarket.firebaseapp.com",
  projectId: "moussaonlinemarket",
  storageBucket: "moussaonlinemarket.firebasestorage.app",
  messagingSenderId: "226336134272",
  appId: "1:226336134272:web:37436457c1095432c0c265",
  measurementId: "G-8M45613MKC"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const analytics = getAnalytics(app);

  