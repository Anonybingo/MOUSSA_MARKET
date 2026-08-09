// Renders the shared header/footer into every page (so there's one place
// to edit the nav) and keeps the nav in sync with sign-in state.

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { loadLanguage, initLangSwitcher, currentLang } from './i18n.js';

const HEADER_HTML = `
<div class="container">
  <a href="index.html" class="site-logo">Market<span>place</span></a>
  <nav class="site-nav">
    <a href="index.html" data-i18n="nav_home">Home</a>
    <a href="products.html" data-i18n="nav_products">Products</a>
    <a href="about.html" data-i18n="nav_about">About</a>
    <a href="dashboard.html" id="nav-dashboard" class="hidden" data-i18n="nav_dashboard">My inquiries</a>
    <a href="admin.html" id="nav-admin" class="hidden" data-i18n="nav_admin">Admin</a>
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
    <a href="login.html" id="nav-login" class="btn btn-gold btn-sm" data-i18n="nav_login">Log in</a>
    <div id="nav-user" class="user-chip hidden">
      <span id="nav-user-name"></span>
      <button id="nav-logout" class="btn btn-outline-light btn-sm" data-i18n="nav_logout">Log out</button>
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
  if (headerMount) headerMount.innerHTML = HEADER_HTML;
  if (footerMount) footerMount.innerHTML = FOOTER_HTML;

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  await loadLanguage(currentLang());
  const langSelect = document.getElementById('lang-select');
  if (langSelect) initLangSwitcher(langSelect);

  highlightActiveNav();
  watchAuthState();
}

function highlightActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach((a) => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
}

function watchAuthState() {
  onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('nav-login');
    const userChip = document.getElementById('nav-user');
    const userName = document.getElementById('nav-user-name');
    const dashLink = document.getElementById('nav-dashboard');
    const adminLink = document.getElementById('nav-admin');

    if (user) {
      loginBtn?.classList.add('hidden');
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
export function requireAuth(redirectTo = 'login.html') {
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
