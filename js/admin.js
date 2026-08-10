import { db, storage } from './firebase-config.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js';
import { requireAuth } from './components.js';
import { invalidateProductCache } from './products.js';
import { t } from './i18n.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function showFieldError(el, text) {
  if (!el) return;
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

const STAGES = ['pending', 'responded', 'negotiating', 'closed'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// currently-selected (not yet uploaded) file for the product form, if any
let selectedImageFile = null;

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

function isStorageUrl(url) {
  return typeof url === 'string' && url.includes('firebasestorage.googleapis.com');
}

async function uploadProductImage(file) {
  const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${sanitizeFilename(file.name)}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// Best-effort cleanup — an old/replaced image failing to delete shouldn't
// block the admin from saving the product, so this never throws upward.
async function deleteProductImage(url) {
  if (!isStorageUrl(url)) return;
  try {
    await deleteObject(ref(storage, url));
  } catch {
    /* ignore — orphaned file, not worth surfacing an error for */
  }
}

export async function initAdmin() {
  const root = document.getElementById('admin-root');
  if (!root) return;

  // This only gates what renders in the browser. The real access control
  // is the Firestore security rule on /products and /inquiries writes —
  // see firestore.rules. A signed-in non-admin hitting this page will see
  // the UI but every write below will be rejected by Firestore.
  await requireAuth();

  wireTabs();
  wireProductForm();
  wireImageInput();
  await renderProducts();
  await renderInquiries();

  document.addEventListener('translations-ready', async () => {
    await renderProducts();
    await renderInquiries();
  });
}

function wireTabs() {
  document.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(btn.dataset.tab)?.classList.remove('hidden');
    });
  });
}

/* ---------------- Products ---------------- */

async function renderProducts() {
  const mount = document.getElementById('admin-products-list');
  if (!mount) return;
  const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));

  mount.innerHTML =
    snap.docs
      .map((d) => {
        const p = d.data();
        const thumb = p.imageUrl
          ? `<img src="${escapeHtml(p.imageUrl)}" alt="">`
          : `<i class="ti ti-photo" aria-hidden="true"></i>`;
        return `
        <div class="inquiry-row">
          <div class="thumb">${thumb}</div>
          <div class="main">
            <h4>${escapeHtml(p.name)}</h4>
            <div class="meta">${escapeHtml(p.category || '')} &middot; ${new Intl.NumberFormat('en-RW').format(p.price || 0)} RWF</div>
          </div>
          <button class="btn btn-outline btn-sm" data-edit="${d.id}">${t('admin_edit')}</button>
          <button class="btn btn-danger btn-sm" data-delete="${d.id}">${t('admin_delete')}</button>
        </div>`;
      })
      .join('') || `<div class="empty-state"><p>—</p></div>`;

  mount.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`${t('admin_delete')}?`)) return;
      const target = snap.docs.find((d) => d.id === btn.dataset.delete);
      const imageUrl = target?.data()?.imageUrl;
      await deleteDoc(doc(db, 'products', btn.dataset.delete));
      deleteProductImage(imageUrl);
      invalidateProductCache();
      renderProducts();
    });
  });

  mount.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = snap.docs.find((d) => d.id === btn.dataset.edit);
      openProductForm(btn.dataset.edit, target?.data());
    });
  });
}

function openProductForm(id, existing) {
  const form = document.getElementById('product-form');
  if (!form) return;
  form.dataset.editId = id || '';
  form.dataset.existingImage = existing?.imageUrl || '';
  selectedImageFile = null;

  form.name.value = existing?.name || '';
  form.price.value = existing?.price || '';
  form.category.value = existing?.category || '';
  form.description.value = existing?.description || '';

  const fileInput = document.getElementById('p-image-file');
  if (fileInput) fileInput.value = '';

  const preview = document.getElementById('product-image-preview');
  if (preview) {
    preview.innerHTML = existing?.imageUrl
      ? `<img src="${escapeHtml(existing.imageUrl)}" alt="">`
      : `<i class="ti ti-photo" aria-hidden="true"></i>`;
  }
  const hint = document.getElementById('product-image-hint');
  hint?.classList.toggle('hidden', !existing?.imageUrl);
  showFieldError(document.getElementById('product-image-error'), '');

  document.getElementById('product-form-panel')?.classList.add('show');
}

function wireImageInput() {
  const fileInput = document.getElementById('p-image-file');
  const preview = document.getElementById('product-image-preview');
  const errorEl = document.getElementById('product-image-error');
  if (!fileInput) return;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    showFieldError(errorEl, '');
    if (!file) {
      selectedImageFile = null;
      return;
    }
    if (!file.type.startsWith('image/')) {
      showFieldError(errorEl, t('admin_image_invalid_type'));
      fileInput.value = '';
      selectedImageFile = null;
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showFieldError(errorEl, t('admin_image_too_large'));
      fileInput.value = '';
      selectedImageFile = null;
      return;
    }
    selectedImageFile = file;
    if (preview) preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
  });
}

function wireProductForm() {
  const form = document.getElementById('product-form');
  if (!form) return;

  document.getElementById('add-product-btn')?.addEventListener('click', () => openProductForm(null, null));
  document.getElementById('product-form-cancel')?.addEventListener('click', () => {
    document.getElementById('product-form-panel')?.classList.remove('show');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const uploadWrap = document.getElementById('product-image-upload');
    submitBtn.disabled = true;

    try {
      let imageUrl = form.dataset.existingImage || '';

      if (selectedImageFile) {
        uploadWrap?.classList.add('uploading');
        const oldUrl = imageUrl;
        imageUrl = await uploadProductImage(selectedImageFile);
        if (oldUrl && oldUrl !== imageUrl) deleteProductImage(oldUrl);
      }

      const data = {
        name: form.name.value.trim(),
        price: Number(form.price.value),
        category: form.category.value.trim(),
        imageUrl,
        description: form.description.value.trim()
      };

      const editId = form.dataset.editId;
      if (editId) {
        await updateDoc(doc(db, 'products', editId), data);
      } else {
        await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
      }

      invalidateProductCache();
      document.getElementById('product-form-panel')?.classList.remove('show');
      form.reset();
      selectedImageFile = null;
      renderProducts();
    } catch (err) {
      showFieldError(document.getElementById('product-image-error'), t('admin_save_error'));
    } finally {
      uploadWrap?.classList.remove('uploading');
      submitBtn.disabled = false;
    }
  });
}

/* ---------------- Inquiries ---------------- */

async function renderInquiries() {
  const mount = document.getElementById('admin-inquiries-list');
  if (!mount) return;
  const snap = await getDocs(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')));

  mount.innerHTML =
    snap.docs
      .map((d) => {
        const inq = d.data();
        const status = STAGES.includes(inq.status) ? inq.status : 'pending';
        const options = STAGES.map(
          (s) => `<option value="${s}" ${status === s ? 'selected' : ''}>${t('status_' + s)}</option>`
        ).join('');
        const messagePart = inq.message ? ` &middot; &ldquo;${escapeHtml(inq.message)}&rdquo;` : '';
        return `
        <div class="inquiry-row">
          <div class="main">
            <h4>${escapeHtml(inq.productName)}</h4>
            <div class="meta">${escapeHtml(inq.userName || inq.userEmail || '')}${messagePart}</div>
          </div>
          <select class="select-inline" data-status="${d.id}">${options}</select>
        </div>`;
      })
      .join('') || `<div class="empty-state"><p>${t('admin_no_inquiries')}</p></div>`;

  mount.querySelectorAll('[data-status]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      await updateDoc(doc(db, 'inquiries', sel.dataset.status), { status: sel.value });
    });
  });
}
