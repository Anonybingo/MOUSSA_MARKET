// Renders the shared header/footer into every page (so there's one place
// to edit the nav) and keeps the nav in sync with sign-in state.

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { loadLanguage, initLangSwitcher, currentLang } from './i18n.js';

const HEADER_HTML = `
<div class="glass-bar">
  <div class="container">
    <a href="/" class="site-logo">Market<span>place</span></a>

    <button id="nav-hamburger" class="hamburger-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav-panel">
      <i class="ti ti-menu-2" aria-hidden="true"></i>
    </button>

    <div class="nav-panel" id="nav-panel">
      <nav class="site-nav">
        <a href="/" data-i18n="nav_home">Home</a>
        <a href="/products/" data-i18n="nav_products">Products</a>
        <a href="/about/" data-i18n="nav_about">About</a>
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
        <a href="/login/" id="nav-login" class="btn btn-gold btn-sm" data-i18n="nav_login">Log in</a>
        <a href="/signup/" id="nav-signup" class="btn btn-outline-light btn-sm" data-i18n="nav_signup">Sign up</a>
        <div id="nav-user" class="user-chip hidden">
          <a href="/profile/" id="nav-user-name" class="user-name-link"></a>
          <button id="nav-logout" class="btn btn-outline-light btn-sm" data-i18n="nav_logout">Log out</button>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const FOOTER_HTML = `
<div class="container">
  <span>&copy; <span id="footer-year"></span> Marketplace &middot; <span data-i18n="footer_rights">All rights reserved.</span></span>
  <span>Kigali, Rwanda</span>
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
  }

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  await loadLanguage(currentLang());
  const langSelect = document.getElementById('lang-select');
  if (langSelect) initLangSwitcher(langSelect);

  highlightActiveNav();
  watchAuthState();
  wireMobileMenu();
  wireScrollEffect();
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
    const userName = document.getElementById('nav-user-name');
    const dashLink = document.getElementById('nav-dashboard');
    const adminLink = document.getElementById('nav-admin');

    if (user) {
      loginBtn?.classList.add('hidden');
      signupBtn?.classList.add('hidden');
      userChip?.classList.remove('hidden');
      dashLink?.classList.remove('hidden');
      if (userName) userName.textContent = user.displayName || user.email;

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const isAdmin = snap.exists() && snap.data().isAdmin === true;
        adminLink?.classList.toggle('hidden', !isAdmin);
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
