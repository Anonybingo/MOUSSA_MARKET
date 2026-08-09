import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { t } from './i18n.js';

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = `form-msg show ${type}`;
}

function redirectTarget() {
  const raw = new URLSearchParams(window.location.search).get('redirect');
  return raw ? decodeURIComponent(raw) : 'dashboard.html';
}

export function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;
  const msg = document.getElementById('login-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
      window.location.href = redirectTarget();
    } catch {
      showMsg(msg, t('login_error'), 'error');
      submitBtn.disabled = false;
    }
  });
}

export function initSignupForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;
  const msg = document.getElementById('signup-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const name = form.name.value.trim();
    const email = form.email.value.trim();

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, form.password.value);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        isAdmin: false,
        createdAt: serverTimestamp()
      });
      window.location.href = redirectTarget();
    } catch {
      showMsg(msg, t('signup_error'), 'error');
      submitBtn.disabled = false;
    }
  });
}
