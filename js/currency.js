// Currency detection + conversion. All prices are stored in RWF (the
// base currency) — this module only affects DISPLAY, converting on the
// fly to whatever currency the visitor is using.
//
// Flow: check localStorage for a previously chosen currency. If there
// isn't one, ask for location permission; if granted, reverse-geocode
// the coordinates to a country and map that to a currency. If permission
// is denied (or geolocation isn't available), fall back to RWF and let
// the person pick manually from the currency switcher in the header —
// deliberately not doing a silent IP-based lookup instead, since that
// would quietly re-track location right after someone said no to sharing it.
//
// Both external calls are free, keyless, CORS-friendly APIs:
//   - api.bigdatacloud.net/data/reverse-geocode-client  (coords -> country)
//   - api.frankfurter.dev/v2/rates                      (exchange rates)

const CURRENCY_KEY = 'currency';
const RATES_CACHE_KEY = 'currencyRatesCache';
const RATES_CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours — rates don't need to be second-fresh

// Common currencies for the manual picker, East African ones first since
// that's this shop's primary market (matches the flyer: Uganda, Kenya,
// Rwanda, Burundi, Tanzania), plus a few widely-used majors.
export const CURRENCY_OPTIONS = ['RWF', 'UGX', 'KES', 'BIF', 'TZS', 'USD', 'EUR', 'GBP'];

// ISO country code -> currency code, for mapping a detected location to a
// currency. Covers the flyer's delivery countries plus common majors;
// anything not listed here falls back to RWF rather than guessing.
const COUNTRY_TO_CURRENCY = {
  RW: 'RWF',
  UG: 'UGX',
  KE: 'KES',
  BI: 'BIF',
  TZ: 'TZS',
  US: 'USD',
  GB: 'GBP',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR',
  PT: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR'
};

let ratesFromRWF = null;

async function loadRates() {
  if (ratesFromRWF) return ratesFromRWF;

  try {
    const cached = JSON.parse(localStorage.getItem(RATES_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.fetchedAt < RATES_CACHE_MS) {
      ratesFromRWF = cached.rates;
      return ratesFromRWF;
    }
  } catch {
    /* corrupted cache — just refetch below */
  }

  try {
    const res = await fetch('https://api.frankfurter.dev/v2/rates?base=RWF');
    if (!res.ok) throw new Error('rates fetch failed');
    const rows = await res.json();
    ratesFromRWF = { RWF: 1 };
    rows.forEach((row) => {
      ratesFromRWF[row.quote] = row.rate;
    });
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: ratesFromRWF, fetchedAt: Date.now() }));
  } catch {
    ratesFromRWF = { RWF: 1 }; // API unreachable — conversion just no-ops to RWF
  }

  return ratesFromRWF;
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  });
}

async function detectCurrencyFromLocation() {
  const position = await getPosition(); // rejects if permission denied/unavailable
  const { latitude, longitude } = position.coords;

  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
  );
  if (!res.ok) throw new Error('reverse geocode failed');
  const data = await res.json();

  return COUNTRY_TO_CURRENCY[data.countryCode] || 'RWF';
}

export function getCurrentCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || 'RWF';
}

export function setCurrency(code) {
  localStorage.setItem(CURRENCY_KEY, code);
}

// Runs once per page (called from components.js): if the visitor hasn't
// chosen a currency yet, try to detect one from their location. Silent
// either way — this only sets a default, it never blocks page content on
// the permission prompt or shows an error if it's denied.
export async function initCurrency() {
  if (localStorage.getItem(CURRENCY_KEY)) return;

  try {
    const detected = await detectCurrencyFromLocation();
    setCurrency(detected);
    document.dispatchEvent(new CustomEvent('currency-changed'));
  } catch {
    // permission denied, timed out, or the geocode call failed — leave
    // no currency saved, so getCurrentCurrency() keeps returning the RWF
    // default until the visitor picks one from the header switcher.
  }
}

export async function convertFromRWF(amountInRWF, targetCurrency) {
  const rates = await loadRates();
  const rate = rates[targetCurrency] ?? 1;
  return amountInRWF * rate;
}

export async function formatPrice(amountInRWF) {
  const currency = getCurrentCurrency();
  const converted = await convertFromRWF(amountInRWF, currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: converted >= 100 ? 0 : 2
    }).format(converted);
  } catch {
    // Intl doesn't recognise the currency code for some reason — fall
    // back to a plain "1,234 XYZ" instead of throwing.
    return `${new Intl.NumberFormat().format(Math.round(converted))} ${currency}`;
  }
}

// Fills in every element carrying a data-price-rwf attribute with that
// amount formatted in whatever currency is currently selected. Rendering
// code sets the attribute (the source of truth, always in RWF) and calls
// this once after inserting its markup; call it again — same root, no
// re-render needed — whenever the currency changes, since only the
// displayed text needs to change, not the underlying card/row markup.
export async function updatePriceDisplays(root = document) {
  const elements = [...root.querySelectorAll('[data-price-rwf]')];
  await Promise.all(
    elements.map(async (el) => {
      const rwf = Number(el.dataset.priceRwf) || 0;
      el.textContent = await formatPrice(rwf);
    })
  );
}
