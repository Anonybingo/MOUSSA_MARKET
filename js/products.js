import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { t } from './i18n.js';
import { updatePriceDisplays } from './currency.js';
import './card-fx.js'; // hover tilt + glare for the cards rendered below
import { activateReveal } from './scroll-fx.js'; // fades + slides the cards in as they scroll into view

// (index.html and others import it from here; it lives in scroll-fx.js now)
export { activateReveal };

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function productCardHTML(id, p) {
  const name = escapeHtml(p.name);
  const category = escapeHtml(p.category || '');
  const thumb = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" alt="${name}">`
    : `<i class="ti ti-photo" aria-hidden="true"></i>`;
  return `
    <a href="/product/?id=${encodeURIComponent(id)}" class="product-card reveal">
      <div class="thumb">${thumb}</div>
      <div class="body">
        <span class="category">${category}</span>
        <h3>${name}</h3>
        <div class="price" data-price-rwf="${Number(p.price) || 0}">&nbsp;</div>
        <span class="btn btn-gold btn-sm">${t('product_contact_btn')}</span>
      </div>
    </a>`;
}

function emptyStateHTML() {
  return `<div class="empty-state"><i class="ti ti-package" aria-hidden="true"></i><p>${t('browse_no_results')}</p></div>`;
}

let cache = null;

async function fetchAllProducts() {
  if (cache) return cache;
  const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
  cache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return cache;
}

export function invalidateProductCache() {
  cache = null;
}

export async function renderFeatured(mountId, count = 3) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const products = await fetchAllProducts();
  const list = products.slice(0, count);
  mount.innerHTML = list.length ? list.map((p) => productCardHTML(p.id, p)).join('') : emptyStateHTML();
  activateReveal(mount);
  updatePriceDisplays(mount);
}

export async function renderProductGrid(mountId, { search = '', category = '' } = {}) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  let products = await fetchAllProducts();

  if (search) {
    const s = search.toLowerCase();
    products = products.filter((p) => (p.name || '').toLowerCase().includes(s));
  }
  if (category) {
    products = products.filter((p) => p.category === category);
  }

  // only the very first render staggers in; after that (search, filters, a
  // language switch) the new cards just appear
  const quick = mount.dataset.rendered === '1';
  mount.dataset.rendered = '1';
  mount.innerHTML = products.length ? products.map((p) => productCardHTML(p.id, p)).join('') : emptyStateHTML();
  activateReveal(mount, { quick });
  updatePriceDisplays(mount);
}

export async function populateCategoryFilter(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const products = await fetchAllProducts();
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  select.innerHTML =
    `<option value="">${t('browse_all_categories')}</option>` +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}
