import { auth, db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { requireAuth } from './components.js';
import { t } from './i18n.js';
import { uploadToImgBB, validateImageFile } from './imgbb.js';

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = `form-msg show ${type}`;
}

export async function initProfile() {
  const user = await requireAuth();

  wireImageUpload(user);
  await wireUsernameForm(user);
  wirePasswordForm(user);
}

/* ---------------- Profile picture ---------------- */

async function wireImageUpload(user) {
  const fileInput = document.getElementById('profile-image-file');
  const preview = document.getElementById('profile-image-preview');
  const errorEl = document.getElementById('profile-image-error');
  const uploadWrap = document.getElementById('profile-image-upload');
  if (!fileInput) return;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const photoURL = snap.exists() ? snap.data().photoURL : null;
    if (photoURL && preview) preview.innerHTML = `<img src="${photoURL}" alt="">`;
  } catch {
    /* no existing photo to show — fine, preview keeps its default icon */
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (errorEl) errorEl.style.display = 'none';
    if (!file) return;

    const problem = validateImageFile(file);
    if (problem) {
      if (errorEl) {
        errorEl.textContent = problem === 'type' ? t('admin_image_invalid_type') : t('admin_image_too_large');
        errorEl.style.display = 'block';
      }
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="">`;
    };
    reader.readAsDataURL(file);

    uploadWrap?.classList.add('uploading');
    try {
      const url = await uploadToImgBB(file);
      await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
    } catch {
      if (errorEl) {
        errorEl.textContent = t('admin_image_upload_failed');
        errorEl.style.display = 'block';
      }
    } finally {
      uploadWrap?.classList.remove('uploading');
    }
  });
}

/* ---------------- Username ---------------- */

async function wireUsernameForm(user) {
  const form = document.getElementById('username-form');
  if (!form) return;
  const msg = document.getElementById('username-msg');

  form.name.value = user.displayName || '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = form.name.value.trim();
    if (!newName) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await updateProfile(user, { displayName: newName });
      await setDoc(doc(db, 'users', user.uid), { name: newName }, { merge: true });

      const navName = document.getElementById('account-menu-name');
      if (navName) navName.textContent = newName;

      showMsg(msg, t('profile_name_success'), 'success');
    } catch {
      showMsg(msg, t('profile_name_error'), 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------------- Password ---------------- */

function wirePasswordForm(user) {
  const form = document.getElementById('password-form');
  if (!form) return;
  const msg = document.getElementById('password-msg');
  const reauthField = document.getElementById('reauth-field');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmNewPassword.value;

    if (newPassword !== confirmPassword) {
      showMsg(msg, t('profile_password_mismatch'), 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await updatePassword(user, newPassword);
      finishPasswordChange(form, msg, reauthField);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        reauthField.classList.remove('hidden');
        const currentPassword = form.currentPassword.value;

        if (!currentPassword) {
          showMsg(msg, t('profile_current_password_hint'), 'error');
          submitBtn.disabled = false;
          return;
        }

        try {
          const credential = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, newPassword);
          finishPasswordChange(form, msg, reauthField);
        } catch {
          showMsg(msg, t('profile_password_error'), 'error');
        }
      } else {
        showMsg(msg, t('profile_password_error'), 'error');
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function finishPasswordChange(form, msg, reauthField) {
  showMsg(msg, t('profile_password_success'), 'success');
  form.reset();
  reauthField.classList.add('hidden');
}
