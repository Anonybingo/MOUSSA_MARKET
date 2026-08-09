import { db } from './firebase-config.js';
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
import { requireAuth } from './components.js';
import { invalidateProductCache } from './products.js';
import { t } from './i18n.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

const STAGES = ['pending', 'responded', 'negotiating', 'closed'];

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
      await deleteDoc(doc(db, 'products', btn.dataset.delete));
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
  form.name.value = existing?.name || '';
  form.price.value = existing?.price || '';
  form.category.value = existing?.category || '';
  form.imageUrl.value = existing?.imageUrl || '';
  form.description.value = existing?.description || '';
  document.getElementById('product-form-panel')?.classList.add('show');
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
    const data = {
      name: form.name.value.trim(),
      price: Number(form.price.value),
      category: form.category.value.trim(),
      imageUrl: form.imageUrl.value.trim(),
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
    renderProducts();
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
