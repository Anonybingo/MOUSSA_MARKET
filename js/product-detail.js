import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { t } from './i18n.js';
import { openContactModal } from './contact.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPrice(price) {
  return `${new Intl.NumberFormat('en-RW').format(price || 0)} RWF`;
}

function getProductId() {
  return new URLSearchParams(window.location.search).get('id');
}

let currentProduct = null;

export async function initProductDetail() {
  const id = getProductId();
  const mount = document.getElementById('product-detail');
  if (!mount) return;

  if (!id) {
    mount.innerHTML = `<div class="empty-state"><p>${t('product_not_found')}</p></div>`;
    return;
  }

  const snap = await getDoc(doc(db, 'products', id));
  if (!snap.exists()) {
    mount.innerHTML = `<div class="empty-state"><p>${t('product_not_found')}</p></div>`;
    return;
  }
  currentProduct = { id: snap.id, ...snap.data() };
  renderProduct();

  document.addEventListener('translations-ready', renderProduct);
}

function renderProduct() {
  const mount = document.getElementById('product-detail');
  const p = currentProduct;
  if (!mount || !p) return;

  const thumb = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}">`
    : `<i class="ti ti-photo" aria-hidden="true"></i>`;

  mount.innerHTML = `
    <div class="thumb" style="border-radius:16px; aspect-ratio:4/3; max-width:100%; font-size:32px;">${thumb}</div>
    <div>
      <span class="category">${escapeHtml(p.category || '')}</span>
      <h1 style="margin:6px 0 10px; font-size:26px;">${escapeHtml(p.name)}</h1>
      <div class="price" style="font-size:22px; margin-bottom:18px;">${formatPrice(p.price)}</div>
      <p style="color:var(--text-secondary); margin-bottom:24px; white-space:pre-line;">${escapeHtml(p.description || '')}</p>
      <button id="contact-btn" class="btn btn-gold">${t('product_contact_btn')}</button>
    </div>
  `;
  document.getElementById('contact-btn')?.addEventListener('click', () => {
    openContactModal({ id: p.id, name: p.name, image: p.imageUrl || '' });
  });
}
