// Home-page hero motion. The CSS half lives in the "Hero motion" blocks of
// css/style.css; this file does the parts CSS can't:
//   1. the intro  — splitting the headline into letters, measuring the accent
//                   word, and deciding WHEN the sequence plays
//   2. the ambient layers — aurora, cursor spotlight, sparkles, floating glass
//                   icons — plus the pointer/scroll parallax that moves them
//
// Progressive enhancement. An inline script in index.html's <head> sets
// html.hero-fx-armed only when motion is allowed (and releases the hero by
// itself after a few seconds if this file never loads). With JS off the hero
// is the static block; with prefers-reduced-motion the layers are built but
// stay still (no intro, no animation, no parallax loop) and the headline keeps
// its gold accent word.
//
// The intro waits until it can actually be seen:
//   - translations applied  -> the headline text is final (and it re-splits
//                              on every language switch, replaying the rise)
//   - web fonts ready       -> letters don't jump when Poppins swaps in
//   - loading overlay gone  -> otherwise it would play behind the loader
// Nothing here blocks the page: all three are just reasons to wait a moment.

const root = document.documentElement;
const hero = document.querySelector('.hero');
const armed = root.classList.contains('hero-fx-armed');

const gates = { translations: false, fonts: false, loader: false };
let played = false;

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ==========================================================================
   1. Intro
   ========================================================================== */

function underline() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'hw-underline');
  svg.setAttribute('viewBox', '0 0 200 14');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M3 9 C 38 2, 74 13, 112 6 S 172 3, 197 8');
  path.setAttribute('pathLength', '1'); // lets CSS draw it with dasharray 1, whatever its real length
  svg.appendChild(path);
  return svg;
}

// The headline's words, and which one is the gold accent: the longest
// ("speaks" / "parle" / ... whichever language is showing).
function headlineWords(h1) {
  const text = h1.textContent.replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const words = text.split(' ');
  let accentAt = 0;
  words.forEach((w, i) => {
    if (w.length > words[accentAt].length) accentAt = i;
  });
  return { text, words, accentAt };
}

// Reduced-motion version: the same gold accent word and underline, but plain
// text — no letter spans, nothing that moves.
function accentOnly(h1) {
  const parts = headlineWords(h1);
  if (!parts || parts.words.length < 2) return;

  h1.textContent = '';
  parts.words.forEach((word, i) => {
    const hw = document.createElement('span');
    hw.className = i === parts.accentAt ? 'hw hw--static' : 'hw';
    hw.textContent = word;
    if (i === parts.accentAt) hw.appendChild(underline());
    h1.appendChild(hw);
    if (i < parts.words.length - 1) h1.appendChild(document.createTextNode(' '));
  });
}

// "Style that speaks for you" -> words > masked letters, the accent word
// getting its shimmer and underline.
function splitHeadline(h1) {
  const parts = headlineWords(h1);
  if (!parts) return null;
  const { text, words, accentAt } = parts;

  h1.setAttribute('aria-label', text); // the letter spans are decorative
  h1.textContent = '';

  let n = 0;
  let accent = null;
  words.forEach((word, i) => {
    const hw = document.createElement('span');
    hw.className = i === accentAt ? 'hw hw--accent' : 'hw';
    hw.setAttribute('aria-hidden', 'true');

    const mask = document.createElement('span');
    mask.className = 'hw-mask';
    for (const ch of word) {
      const hl = document.createElement('span');
      hl.className = 'hl';
      hl.textContent = ch;
      hl.style.setProperty('--i', n++);
      mask.appendChild(hl);
    }
    hw.appendChild(mask);
    if (i === accentAt) {
      hw.appendChild(underline());
      accent = hw;
    }

    h1.appendChild(hw);
    if (i < words.length - 1) h1.appendChild(document.createTextNode(' ')); // real spaces: wrapping + copy/paste
  });
  return accent;
}

// Each letter of the accent word needs to know where it sits inside the word
// so the shimmer reads as ONE band crossing the word rather than a separate
// gradient per letter. Stored in em so it survives the fluid font size.
function measureAccent() {
  const accent = hero.querySelector('.hw--accent');
  if (!accent) return;
  const size = parseFloat(getComputedStyle(accent).fontSize) || 16;
  accent.querySelectorAll('.hl').forEach((hl) => {
    hl.style.setProperty('--ox', `${(hl.offsetLeft / size).toFixed(4)}em`);
  });
}

function prepareHeadline() {
  const h1 = hero.querySelector('h1');
  if (!h1) return;
  splitHeadline(h1);
  measureAccent();
}

function play() {
  if (played) return;
  played = true;
  try {
    sessionStorage.setItem('heroIntroSeen', '1');
  } catch {
    /* storage blocked — nothing lost, just no shortened repeat */
  }
  // a beat after the overlay's own fade-out so the first frames aren't lost under it
  setTimeout(() => root.classList.add('hero-fx-play'), 160);
}

function maybePlay() {
  if (gates.translations && gates.fonts && gates.loader) play();
}

function initIntro() {
  try {
    if (sessionStorage.getItem('heroIntroSeen')) root.style.setProperty('--dscale', '0.4');
  } catch {
    /* full-length intro, fine */
  }

  prepareHeadline(); // whatever text the HTML has; redone once translations land

  document.addEventListener('translations-ready', () => {
    prepareHeadline();
    gates.translations = true;
    maybePlay();
  });
  document.addEventListener('loader-hidden', () => {
    gates.loader = true;
    maybePlay();
  });

  const fontsReady = document.fonts
    ? Promise.race([
        Promise.all([document.fonts.load('600 1em Poppins'), document.fonts.ready]),
        new Promise((resolve) => setTimeout(resolve, 1500))
      ])
    : Promise.resolve();
  fontsReady
    .catch(() => {})
    .then(() => {
      gates.fonts = true;
      measureAccent(); // metrics may have changed when the web font arrived
      maybePlay();
    });

  // Safety net if something upstream never reports in (offline, an error in
  // the page script): play anyway — but never behind a loader that's still up.
  let waits = 0;
  const fallback = () => {
    if (played) return;
    if (document.querySelector('.loader-overlay.show') && ++waits < 20) {
      setTimeout(fallback, 500);
      return;
    }
    play();
  };
  setTimeout(fallback, 4500);
}

/* ==========================================================================
   2. Ambient layers
   ========================================================================== */

// Tabler Icons (MIT) outline paths, inlined so the hero needs no icon font.
// Order of FLOATERS must match the .fx-floater:nth-child() positions in the CSS.
const ICONS = {
  shirt: '<path d="M15 4l6 2v5h-3v8a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-8h-3v-5l6 -2a3 3 0 0 0 6 0" />',
  'shopping-bag': '<path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304" /><path d="M9 11v-5a3 3 0 0 1 6 0v5" />',
  hanger: '<path d="M14 6a2 2 0 1 0 -4 0c0 1.667 .67 3 2 4h-.008l7.971 4.428a2 2 0 0 1 1.029 1.749v.823a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-.823a2 2 0 0 1 1.029 -1.749l7.971 -4.428" />',
  sunglasses: '<path d="M8 4h-2l-3 10" /><path d="M16 4h2l3 10" /><path d="M10 16h4" /><path d="M21 16.5a3.5 3.5 0 0 1 -7 0v-2.5h7v2.5" /><path d="M10 16.5a3.5 3.5 0 0 1 -7 0v-2.5h7v2.5" /><path d="M4 14l4.5 4.5" /><path d="M15 14l4.5 4.5" />',
  diamond: '<path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /><path d="M10 12l-2 -2.2l.6 -1" />',
  crown: '<path d="M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4l4 -6" />',
  tag: '<path d="M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3" />'
};

// [icon, parallax depth] — deeper (bigger number) = moves more with the pointer
const FLOATERS = [
  ['shirt', 1.0],
  ['shopping-bag', 1.15],
  ['hanger', 0.55],
  ['sunglasses', 0.65],
  ['diamond', 0.45],
  ['crown', 0.5],
  ['tag', 0.4]
];

const SPARKLE_COUNT = 18;

function buildLayers() {
  if (hero.querySelector('.hero-fx')) return;

  const symbols = Object.entries(ICONS)
    .map(([name, body]) => `<symbol id="fx-i-${name}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('');

  const sparkles = Array.from({ length: SPARKLE_COUNT }, () => {
    const x = (4 + Math.random() * 92).toFixed(1);
    const y = (22 + Math.random() * 70).toFixed(1); // below the white fade at the top edge
    const s = (5 + Math.random() * 9).toFixed(1);
    const dur = (2.6 + Math.random() * 3).toFixed(2);
    const del = (-Math.random() * 6).toFixed(2); // negative: already mid-cycle, so they don't pulse in unison
    return `<i class="fx-spark" style="--x:${x}%;--y:${y}%;--s:${s}px;--dur:${dur}s;--del:${del}s"></i>`;
  }).join('');

  const floaters = FLOATERS.map(
    ([icon], i) =>
      `<div class="fx-floater" style="--n:${i}"><div class="fx-bubble"><svg viewBox="0 0 24 24"><use href="#fx-i-${icon}"/></svg></div></div>`
  ).join('');

  const fx = document.createElement('div');
  fx.className = 'hero-fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML = `
    <svg width="0" height="0" style="position:absolute" focusable="false"><defs>${symbols}</defs></svg>
    <div class="fx-blobs"><span class="fx-blob fx-blob--a"></span><span class="fx-blob fx-blob--b"></span><span class="fx-blob fx-blob--c"></span></div>
    <span class="fx-spot"></span>
    <div class="fx-sparkles">${sparkles}</div>
    <div class="fx-floaters">${floaters}</div>`;
  hero.prepend(fx);

  const cue = document.createElement('div');
  cue.className = 'hero-scroll';
  cue.setAttribute('aria-hidden', 'true');
  hero.appendChild(cue);
}

/* ---- keep the icons off the text ------------------------------------------
   The icons' positions are %-of-hero in CSS, which can't know how tall or wide
   the text came out in this language at this screen size (French is one long
   line, Swahili wraps to two, and the copy can change any time). So after
   layout each icon is tested against where the text really is, and the ones
   that would sit on it are hidden. Rest positions only: offsetLeft/offsetTop
   report layout, not paint, so the intro's rise and the scroll parallax can't
   throw it off. */

function layoutRect(el) {
  let left = 0;
  let top = 0;
  for (let n = el; n && n !== hero; n = n.offsetParent) {
    left += n.offsetLeft;
    top += n.offsetTop;
  }
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight };
}

function clearFloaters() {
  const PAD = 12;
  const text = [...hero.querySelectorAll('.hw, .eyebrow, p, .search-bar')].map(layoutRect);
  // the white fade under the navbar is no place for an icon either
  text.push({ left: 0, top: 0, right: hero.offsetWidth, bottom: hero.offsetHeight * 0.18 });

  hero.querySelectorAll('.fx-floater').forEach((f) => {
    f.hidden = false; // measure from a clean slate: the layout may have changed since
    if (!f.offsetParent) return; // a CSS breakpoint already hides this one
    const l = f.offsetLeft - PAD;
    const t = f.offsetTop - PAD;
    const r = f.offsetLeft + f.offsetWidth + PAD;
    const b = f.offsetTop + f.offsetHeight + PAD;
    f.hidden = text.some((q) => l < q.right && r > q.left && t < q.bottom && b > q.top);
  });
}

// Re-check whenever the text or its room could have changed: the hero resizing
// (window, rotation, content height), a language switch, the web font landing.
function watchLayout() {
  let queued = 0;
  const schedule = () => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      clearFloaters();
    });
  };
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(hero);
  else window.addEventListener('resize', schedule);
  document.addEventListener('translations-ready', schedule);
  if (document.fonts) document.fonts.ready.then(schedule);
  schedule();
}

/* ---- pointer + scroll parallax -------------------------------------------
   One rAF loop, running only while the hero is on screen AND something is
   still moving: the floaters ease toward the pointer, the spotlight follows
   it, and scrolling lifts/fades the hero content while the layers lag behind
   it. Touch devices have no pointer, so there the floaters drift on a slow
   sine path instead. */

const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function initMotion() {
  const content = hero.querySelector('.container');
  const blobs = hero.querySelector('.fx-blobs');
  const spot = hero.querySelector('.fx-spot');
  const cue = hero.querySelector('.hero-scroll');
  const floaters = [...hero.querySelectorAll('.fx-floater')].map((el, i) => ({
    el,
    depth: FLOATERS[i] ? FLOATERS[i][1] : 0.5
  }));

  // tx/ty: where the pointer is (-1..1 across the hero); x/y: eased toward it
  // stx/sty: pointer in pixels inside the hero; sx/sy: spotlight eased toward it
  const v = { tx: 0, ty: 0, x: 0, y: 0, stx: 0, sty: 0, sx: 0, sy: 0, p: 0 };
  let raf = 0;
  let visible = true;

  function updateScroll() {
    const r = hero.getBoundingClientRect();
    v.p = clamp(-r.top / Math.max(r.height, 1), 0, 1);
  }

  function frame(now) {
    raf = 0;

    if (!FINE_POINTER) {
      v.tx = Math.sin(now / 4300) * 0.8;
      v.ty = Math.cos(now / 5700) * 0.7;
    }
    v.x += (v.tx - v.x) * 0.07;
    v.y += (v.ty - v.y) * 0.07;
    v.sx += (v.stx - v.sx) * 0.12;
    v.sy += (v.sty - v.sy) * 0.12;

    for (const f of floaters) {
      const dx = v.x * f.depth * 36;
      const dy = v.y * f.depth * 28 + v.p * f.depth * 140;
      f.el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    }
    if (blobs) {
      blobs.style.transform = `translate3d(${(v.x * -18).toFixed(1)}px, ${(v.y * -14 + v.p * 90).toFixed(1)}px, 0)`;
    }
    if (spot) spot.style.transform = `translate3d(${v.sx.toFixed(1)}px, ${v.sy.toFixed(1)}px, 0)`;
    if (content) {
      content.style.transform = `translate3d(0, ${(v.p * 60).toFixed(1)}px, 0)`;
      content.style.opacity = Math.max(0, 1 - v.p * 1.15).toFixed(3);
    }
    if (cue) cue.style.setProperty('--cue', clamp(1 - v.p * 5, 0, 1).toFixed(3));

    const settling =
      Math.abs(v.tx - v.x) > 0.001 ||
      Math.abs(v.ty - v.y) > 0.001 ||
      Math.abs(v.stx - v.sx) > 0.3 ||
      Math.abs(v.sty - v.sy) > 0.3;
    if (!FINE_POINTER || settling) kick();
  }

  function kick() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  if (FINE_POINTER) {
    hero.addEventListener('pointerenter', (e) => {
      const r = hero.getBoundingClientRect();
      // start the spotlight where the pointer is, instead of sweeping in from the corner
      v.stx = v.sx = e.clientX - r.left;
      v.sty = v.sy = e.clientY - r.top;
      hero.classList.add('is-pointing');
      kick();
    });
    hero.addEventListener(
      'pointermove',
      (e) => {
        const r = hero.getBoundingClientRect();
        v.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        v.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        v.stx = e.clientX - r.left;
        v.sty = e.clientY - r.top;
        kick();
      },
      { passive: true }
    );
    hero.addEventListener('pointerleave', () => {
      v.tx = 0;
      v.ty = 0;
      hero.classList.remove('is-pointing');
      kick();
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      updateScroll();
      kick();
    },
    { passive: true }
  );
  window.addEventListener('resize', () => {
    updateScroll();
    kick();
  });

  // Off-screen: stop the loop AND pause the CSS animations (see .is-offscreen)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        hero.classList.toggle('is-offscreen', !visible);
        if (visible) kick();
      },
      { threshold: 0 }
    ).observe(hero);
  }

  updateScroll();
  kick();
}

/* ========================================================================== */

function init() {
  if (!hero) return;
  buildLayers(); // present either way; only animated/moved when armed
  if (!armed) {
    // reduced motion: a still hero, but it keeps the gold accent word. The
    // translations rewrite the headline's text, so redo it after each one.
    const h1 = hero.querySelector('h1');
    if (h1) {
      accentOnly(h1);
      document.addEventListener('translations-ready', () => accentOnly(h1));
    }
    watchLayout();
    return;
  }
  initIntro();
  initMotion();
  watchLayout();
}

try {
  init();
} catch (err) {
  // never leave the hero parked because of a bug here
  console.error('hero-fx:', err);
  root.classList.remove('hero-fx-armed');
}
