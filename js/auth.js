import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
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
  return raw ? decodeURIComponent(raw) : '/dashboard/';
}

// Reusable eye-icon show/hide toggle. Works on any <button data-toggle-password="inputId">
// placed next to a password <input> with that id — used on both login and signup.
export function initPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;
    btn.addEventListener('click', () => {
      const willShow = input.type === 'password';
      input.type = willShow ? 'text' : 'password';
      btn.innerHTML = willShow
        ? '<i class="ti ti-eye-off" aria-hidden="true"></i>'
        : '<i class="ti ti-eye" aria-hidden="true"></i>';
      btn.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
    });
  });
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

// "Forgot password?" reveals a small inline panel (rather than a redirect) —
// collects an email, validates it, and uses Firebase's own reset-email flow.
// There's no separate/fake reset system here on purpose.
export function initForgotPassword() {
  const link = document.getElementById('forgot-password-link');
  const panel = document.getElementById('forgot-password-panel');
  const sendBtn = document.getElementById('send-reset-btn');
  const emailInput = document.getElementById('reset-email');
  const msg = document.getElementById('reset-msg');
  if (!link || !panel || !sendBtn || !emailInput) return;

  link.addEventListener('click', (e) => {
    e.preventDefault();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) emailInput.focus();
  });

  sendBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showMsg(msg, t('login_reset_invalid_email'), 'error');
      return;
    }
    sendBtn.disabled = true;
    try {
      await sendPasswordResetEmail(auth, email);
      showMsg(msg, t('login_reset_success'), 'success');
    } catch {
      // Firebase intentionally doesn't reveal whether the email exists, to
      // avoid leaking which addresses are registered — this covers both a
      // genuine send failure and an unregistered address.
      showMsg(msg, t('login_reset_error'), 'error');
    } finally {
      sendBtn.disabled = false;
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
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmInput = form.querySelector('[name="confirmPassword"]');

    if (confirmInput && password !== confirmInput.value) {
      showMsg(msg, t('signup_password_mismatch'), 'error');
      return;
    }

    submitBtn.disabled = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
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
