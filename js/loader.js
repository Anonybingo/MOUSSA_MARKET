// Reusable loading overlay. Builds itself once on first use, then just
// toggles visibility — cheap to call showLoader()/hideLoader() as often as
// you like (form submits, image uploads, initial fetches, anything async).
//
// Deliberately does NOT depend on i18n.js's t() for its default text: the
// loader is shown at the very start of page load, before the translations
// fetch has necessarily resolved, so t() would return the raw key string
// ("common_loading") instead of real text. It reads the saved language
// directly from localStorage instead — synchronous, always available.
//
// Usage from any page/module:
//   import { showLoader, hideLoader } from '/js/loader.js';
//   showLoader();                     // generic "Loading..."
//   showLoader('Uploading image...'); // or a specific message
//   hideLoader();

const ICONS = [
  'ti-shopping-cart',
  'ti-coin',
  'ti-tag',
  'ti-shopping-bag',
  'ti-receipt',
  'ti-credit-card',
  'ti-gift',
  'ti-truck-delivery'
];

const LOADING_TEXT = {
  en: 'Loading...',
  rw: 'Birimo gupakira...',
  fr: 'Chargement...',
  sw: 'Inapakia...'
};

function defaultLoadingText() {
  const lang = localStorage.getItem('lang');
  return LOADING_TEXT[lang] || LOADING_TEXT.en;
}

let overlay = null;

function build() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'loader-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-busy', 'true');

  const iconsWrap = document.createElement('div');
  iconsWrap.className = 'loader-icons';
  iconsWrap.setAttribute('aria-hidden', 'true');

  const COUNT = 16;
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('i');
    el.className = `ti ${ICONS[i % ICONS.length]}`;
    el.style.left = `${Math.random() * 100}%`;
    el.style.fontSize = `${16 + Math.random() * 16}px`;
    el.style.setProperty('--r', `${Math.round(Math.random() * 360 - 180)}deg`);
    el.style.animationDuration = `${3.5 + Math.random() * 3}s`;
    el.style.animationDelay = `${(Math.random() * -6).toFixed(2)}s`;
    iconsWrap.appendChild(el);
  }

  const center = document.createElement('div');
  center.className = 'loader-center';
  center.innerHTML = `
    <div class="loader-spinner"></div>
    <p class="loader-text">${defaultLoadingText()}</p>
  `;

  overlay.appendChild(iconsWrap);
  overlay.appendChild(center);
  document.body.appendChild(overlay);
}

export function showLoader(message) {
  build();
  const textEl = overlay.querySelector('.loader-text');
  if (textEl) textEl.textContent = message || defaultLoadingText();
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

export function hideLoader() {
  if (!overlay) return;
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}
