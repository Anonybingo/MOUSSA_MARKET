// Simple i18n: loads a JSON file of key/value strings per language and
// swaps text into any element tagged with data-i18n / data-i18n-placeholder.
// Dynamic content (rendered after page load, e.g. product cards) should
// call t(key) directly instead of relying on the data-i18n scan, and should
// re-render on the "translations-ready" event so it stays in sync when the
// user switches language.

const SUPPORTED_LANGS = ['en', 'rw', 'fr', 'sw'];
const DEFAULT_LANG = 'en';

let currentStrings = {};

function getSavedLang() {
  const saved = localStorage.getItem('lang');
  return SUPPORTED_LANGS.includes(saved) ? saved : DEFAULT_LANG;
}

export async function loadLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
  try {
    const res = await fetch(`lang/${lang}.json`);
    currentStrings = await res.json();
  } catch (err) {
    if (lang !== DEFAULT_LANG) {
      await loadLanguage(DEFAULT_LANG);
      return;
    }
    currentStrings = {};
  }
  localStorage.setItem('lang', lang);
  document.documentElement.setAttribute('lang', lang);
  applyTranslations();
}

export function t(key) {
  return currentStrings[key] || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (currentStrings[key]) el.textContent = currentStrings[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (currentStrings[key]) el.setAttribute('placeholder', currentStrings[key]);
  });
  document.dispatchEvent(new CustomEvent('translations-ready'));
}

export function initLangSwitcher(selectEl) {
  selectEl.value = getSavedLang();
  selectEl.addEventListener('change', () => loadLanguage(selectEl.value));
}

export function currentLang() {
  return getSavedLang();
}
