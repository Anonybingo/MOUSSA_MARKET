// Small key-value settings store in Firestore (settings/general), so things
// like the WhatsApp number can be changed from the admin panel instead of
// requiring a code edit + redeploy every time.

import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

let cached = null;

export async function getSettings() {
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    cached = snap.exists() ? snap.data() : {};
  } catch {
    cached = {};
  }
  return cached;
}

export async function updateSettings(data) {
  await setDoc(doc(db, 'settings', 'general'), data, { merge: true });
  cached = { ...(cached || {}), ...data };
}
