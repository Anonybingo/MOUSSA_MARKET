// Renders the shared header/footer into every page (so there's one place
// to edit the nav) and keeps the nav in sync with sign-in state.

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { loadLanguage, initLangSwitcher, currentLang } from './i18n.js';
import { openContactModal } from './contact.js';
import { initCurrency, getCurrentCurrency, setCurrency } from './currency.js';
import { activateReveal } from './scroll-fx.js'; // also starts the page-wide scroll effects (progress line, rising headings)

const HEADER_HTML = `
<div class="header-decor" aria-hidden="true">
  <i class="ti ti-shopping-cart" style="top:6%; left:3%; font-size:29px; color:var(--navy); --r:-18deg; animation-duration:9s; animation-delay:-2.1s;"></i>
  <i class="ti ti-coin" style="top:58%; left:8%; font-size:22px; color:var(--gold-dark); --r:14deg; animation-duration:7.5s; animation-delay:-4.6s;"></i>
  <i class="ti ti-tag" style="top:10%; left:21%; font-size:19px; color:var(--navy); --r:26deg; animation-duration:10s; animation-delay:-0.8s;"></i>
  <i class="ti ti-shopping-bag" style="top:62%; left:31%; font-size:24px; color:var(--navy); --r:-11deg; animation-duration:8.2s; animation-delay:-3.4s;"></i>
  <i class="ti ti-receipt" style="top:8%; left:42%; font-size:19px; color:var(--gold-dark); --r:-8deg; animation-duration:9.6s; animation-delay:-5.2s;"></i>
  <i class="ti ti-credit-card" style="top:12%; right:23%; font-size:23px; color:var(--navy); --r:15deg; animation-duration:7.8s; animation-delay:-1.5s;"></i>
  <i class="ti ti-gift" style="top:60%; right:12%; font-size:24px; color:var(--navy); --r:-16deg; animation-duration:8.6s; animation-delay:-4s;"></i>
  <i class="ti ti-truck-delivery" style="top:14%; right:4%; font-size:27px; color:var(--gold-dark); --r:9deg; animation-duration:10.4s; animation-delay:-2.8s;"></i>
  <i class="ti ti-coin" style="top:60%; right:35%; font-size:18px; color:var(--navy); --r:-22deg; animation-duration:6.8s; animation-delay:-3.9s;"></i>
</div>
<div class="glass-bar">
  <div class="container">
    <a href="/" class="site-logo">
      <img src="/assets/logo-34.png" srcset="/assets/logo-34.png 1x, /assets/logo-68.png 2x, /assets/logo-102.png 3x" width="30" height="34" alt="" class="site-logo-mark">
      Haki <span>Boutique</span>
    </a>

    <button id="nav-hamburger" class="hamburger-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav-panel">
      <i class="ti ti-menu-2" aria-hidden="true"></i>
    </button>

    <div class="nav-panel" id="nav-panel">
      <nav class="site-nav">
        <a href="/" data-i18n="nav_home">Home</a>
        <a href="/products/" data-i18n="nav_products">Products</a>
        <a href="/about/" data-i18n="nav_about">About</a>
        <a href="#" id="nav-contact" data-i18n="nav_contact">Contact us</a>
        <a href="/dashboard/" id="nav-dashboard" class="hidden" data-i18n="nav_dashboard">My inquiries</a>
        <a href="/admin/" id="nav-admin" class="hidden" data-i18n="nav_admin">Admin</a>
      </nav>
      <div class="header-actions">
        <div class="lang-switch">
          <select id="lang-select" aria-label="Language">
            <option value="en">EN</option>
            <option value="rw">RW</option>
            <option value="fr">FR</option>
            <option value="sw">SW</option>
          </select>
        </div>
        <div class="currency-switch">
          <select id="currency-select" aria-label="Currency">
            <option value="RWF">RWF</option>
            <option value="UGX">UGX</option>
            <option value="KES">KES</option>
            <option value="BIF">BIF</option>
            <option value="TZS">TZS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
        <a href="/login/" id="nav-login" class="btn btn-gold btn-sm" data-i18n="nav_login">Log in</a>
        <a href="/signup/" id="nav-signup" class="btn btn-outline-light btn-sm" data-i18n="nav_signup">Sign up</a>
        <div id="nav-user" class="user-chip hidden">
          <button type="button" id="nav-avatar-btn" class="nav-avatar-btn" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">
            <span class="nav-avatar" id="nav-avatar"><i class="ti ti-user" aria-hidden="true"></i></span>
          </button>
          <div class="account-menu" id="account-menu">
            <div class="account-menu-name" id="account-menu-name"></div>
            <a href="/profile/" data-i18n="account_menu_settings">Settings</a>
            <a href="/terms/" data-i18n="account_menu_terms">Terms and conditions</a>
            <button type="button" id="nav-logout" data-i18n="nav_logout">Log out</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const FOOTER_HTML = `
<div class="container footer-grid">
  <div class="footer-col reveal">
    <div class="footer-brand">Haki <span>Boutique</span></div>
    <p class="footer-tagline" data-i18n="footer_tagline">Style that speaks for you.</p>
    <p class="footer-based-in">Based in Kigali, Rwanda</p>
  </div>
  <div class="footer-col reveal">
    <h4 data-i18n="footer_contact_title">Contact us</h4>
    <a href="tel:+250782006296">+250 782 006 296</a>
    <a href="tel:+250739928876">+250 739 928 876</a>
    <a href="https://wa.me/250781863361" target="_blank" rel="noopener">WhatsApp: +250 781 863 361</a>
    <a href="mailto:hakizimanmoussa@gmail.com">hakizimanmoussa@gmail.com</a>
  </div>
  <div class="footer-col reveal">
    <h4 data-i18n="footer_countries_title">We deliver to</h4>
    <p>Uganda &middot; Kenya &middot; Rwanda &middot; Burundi &middot; Tanzania</p>
  </div>
</div>
<div class="container footer-bottom reveal">
  <span>&copy; <span id="footer-year"></span> Haki Boutique &middot; <span data-i18n="footer_rights">All rights reserved.</span></span>
</div>
`;

export async function renderChrome() {
  const headerMount = document.getElementById('site-header');
  const footerMount = document.getElementById('site-footer');
  if (headerMount) {
    headerMount.classList.add('site-header');
    headerMount.innerHTML = HEADER_HTML;
  }
  if (footerMount) {
    footerMount.classList.add('site-footer');
    footerMount.innerHTML = FOOTER_HTML;
    activateReveal(footerMount, { step: 140 }); // the columns slide up one after another
  }

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  await loadLanguage(currentLang());
  const langSelect = document.getElementById('lang-select');
  if (langSelect) initLangSwitcher(langSelect);

  wireCurrencySwitcher();
  initCurrency(); // async, deliberately not awaited — see currency.js for why

  highlightActiveNav();
  watchAuthState();
  wireMobileMenu();
  wireScrollEffect();
  wireContactLink();
  wireAccountMenu();
}

function wireCurrencySwitcher() {
  const select = document.getElementById('currency-select');
  if (!select) return;

  select.value = getCurrentCurrency();
  select.addEventListener('change', () => {
    setCurrency(select.value);
    document.dispatchEvent(new CustomEvent('currency-changed'));
  });

  // if geolocation-based detection finishes after the dropdown already
  // rendered, reflect whatever it picked instead of leaving RWF showing
  document.addEventListener('currency-changed', () => {
    select.value = getCurrentCurrency();
  });
}

function wireContactLink() {
  const link = document.getElementById('nav-contact');
  link?.addEventListener('click', (e) => {
    e.preventDefault();
    openContactModal();
  });
}

function wireMobileMenu() {
  const btn = document.getElementById('nav-hamburger');
  const panel = document.getElementById('nav-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.innerHTML = isOpen
      ? '<i class="ti ti-x" aria-hidden="true"></i>'
      : '<i class="ti ti-menu-2" aria-hidden="true"></i>';
  });

  // close the panel after navigating (mobile) so it doesn't stay open
  panel.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<i class="ti ti-menu-2" aria-hidden="true"></i>';
    }
  });
}

function wireScrollEffect() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const update = () => header.classList.toggle('scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function highlightActiveNav() {
  // With folder-style URLs (/products/ instead of products.html), compare
  // the first path segment rather than the last — a trailing slash makes
  // split('/').pop() return '' for every page, which matched nothing.
  const currentSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
  document.querySelectorAll('.site-nav a').forEach((a) => {
    const hrefSegment = (a.getAttribute('href') || '').split('/').filter(Boolean)[0] || '';
    if (hrefSegment === currentSegment) a.classList.add('active');
  });
}

function watchAuthState() {
  onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('nav-login');
    const signupBtn = document.getElementById('nav-signup');
    const userChip = document.getElementById('nav-user');
    const avatarEl = document.getElementById('nav-avatar');
    const menuName = document.getElementById('account-menu-name');
    const dashLink = document.getElementById('nav-dashboard');
    const adminLink = document.getElementById('nav-admin');

    if (user) {
      loginBtn?.classList.add('hidden');
      signupBtn?.classList.add('hidden');
      userChip?.classList.remove('hidden');
      dashLink?.classList.remove('hidden');
      if (menuName) menuName.textContent = user.displayName || user.email;

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        adminLink?.classList.toggle('hidden', data.isAdmin !== true);
        if (avatarEl) {
          avatarEl.innerHTML = data.photoURL
            ? `<img src="${data.photoURL}" alt="">`
            : '<i class="ti ti-user" aria-hidden="true"></i>';
        }
      } catch {
        adminLink?.classList.add('hidden');
      }
    } else {
      loginBtn?.classList.remove('hidden');
      signupBtn?.classList.remove('hidden');
      userChip?.classList.add('hidden');
      dashLink?.classList.add('hidden');
      adminLink?.classList.add('hidden');
    }
  });

  // Event delegation: the logout button is injected dynamically, so we
  // listen on document rather than the (not-yet-existing) button itself.
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'nav-logout') {
      signOut(auth);
    }
  });
}

function wireAccountMenu() {
  const btn = document.getElementById('nav-avatar-btn');
  const menu = document.getElementById('account-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // any click inside the menu (a link or the sign-out button) closes it
  menu.addEventListener('click', () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });

  // click anywhere outside closes it too
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('open')) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
}

// Call from any page that requires sign-in (dashboard, admin). Redirects to
// login if signed out; resolves with the user once auth state is known.
// Note: this only protects the page UI — actual data access is enforced by
// Firestore security rules regardless of what this function does.
export function requireAuth(redirectTo = '/login/') {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}
