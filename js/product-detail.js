import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { t } from './i18n.js';

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
let currentUser = null;

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
  wireModal();

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateContactButton();
  });

  document.addEventListener('translations-ready', () => {
    renderProduct();
    wireModal();
  });
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
  document.getElementById('contact-btn')?.addEventListener('click', onContactClick);
  updateContactButton();
}

function updateContactButton() {
  const btn = document.getElementById('contact-btn');
  if (!btn) return;
  btn.textContent = currentUser ? t('product_contact_btn') : t('product_login_to_contact');
}

function onContactClick() {
  if (!currentUser) {
    const redirect = encodeURIComponent(`/product/?id=${currentProduct.id}`);
    window.location.href = `/login/?redirect=${redirect}`;
    return;
  }
  const overlay = document.getElementById('contact-modal');
  overlay?.classList.add('show');
}

function wireModal() {
  const overlay = document.getElementById('contact-modal');
  if (!overlay) return;

  document.getElementById('modal-close')?.addEventListener('click', () => overlay.classList.remove('show'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('show');
  });

  const form = document.getElementById('contact-form');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await addDoc(collection(db, 'inquiries'), {
        productId: currentProduct.id,
        productName: currentProduct.name,
        productImage: currentProduct.imageUrl || '',
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email,
        message: form.message.value.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      const modal = overlay.querySelector('.modal');
      if (modal) modal.innerHTML = `<p style="padding:8px 0 4px;">${t('contact_modal_success')}</p>`;
    } catch {
      submitBtn.disabled = false;
    }
  });
}
