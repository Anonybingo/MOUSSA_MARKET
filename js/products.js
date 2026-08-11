import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { t } from './i18n.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPrice(price) {
  return `${new Intl.NumberFormat('en-RW').format(price || 0)} RWF`;
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
        <div class="price">${formatPrice(p.price)}</div>
        <span class="btn btn-gold btn-sm">${t('product_contact_btn')}</span>
      </div>
    </a>`;
}

function emptyStateHTML() {
  return `<div class="empty-state"><i class="ti ti-package" aria-hidden="true"></i><p>${t('browse_no_results')}</p></div>`;
}

// Fades + slides each card in, one after another, as it scrolls into view.
// Re-observing on every render is intentional: it makes the effect replay
// after a search/filter change swaps in a new set of cards.
function activateReveal(mount) {
  const cards = mount.querySelectorAll('.reveal');
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  cards.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i * 70, 350)}ms`;
    observer.observe(el);
  });
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

  mount.innerHTML = products.length ? products.map((p) => productCardHTML(p.id, p)).join('') : emptyStateHTML();
  activateReveal(mount);
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
