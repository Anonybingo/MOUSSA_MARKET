// "The Edit": the pinned scroll scene on the home page (CSS: "The Edit" in
// css/style.css). A tall section scrolls past a dark card that sticks to the
// screen, and as it does eight garments take shape one after another:
//
//     gold dust gathers into a t-shirt  ->  a gold-foil drawing of it condenses
//     over the dust  ->  it dissolves back into dust  ->  the dust flows into a
//     pair of socks  ->  ...  ->  sunglasses  ->  the dust scatters
//
// EVERYTHING is a function of how far the section has scrolled, so it runs
// backwards just as well, and jumping to any spot (the dots, the scrollbar, a
// reload in the middle) shows exactly the right picture. The scroll position is
// turned into `u`, "units": garment k is in the middle of the screen at u = k.
//
//   dust flight into garment k    u = k - 0.5 ... k - 0.02   (each speck flies
//                                                              for part of this)
//   foil drawing fades in         u = k - 0.04 ... k + 0.14
//   foil drawing fades out        u = k + 0.34 ... k + 0.46   (the dust takes over
//                                                              and flies on)
//   after the last garment the dust scatters again.
//
// Parts, all built here around the markup in index.html (a still grid of the same
// eight drawings, which is what stays if this script can't run):
//   - a canvas with the dust: ~4000 specks, each given a spot in every garment
//     (picked at random from the drawing, brighter parts more likely, then sorted
//     so the dust flows from the top of one shape to the top of the next)
//   - the foil drawings (<img> of the SVGs in /assets/items/, the same pictures the
//     dust was sampled from, so they line up) with a light sweep across them
//   - the big outlined word, the counter, the name, the dots, the button
// The whole thing sleeps while the section is off screen and draws at a low
// rate while nothing moves. With prefers-reduced-motion, or on a very short
// screen, none of it runs and the still grid stays.

import { seededRandom, samplePicture } from './hero-dust.js';
import { t } from './i18n.js';

window.__editScene = true; // tells the arming script in <head> that we are alive

const section = document.querySelector('.edit');
const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const tall = window.matchMedia('(min-height: 481px)');
const coarse = window.matchMedia('(pointer: coarse)');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const ss = (a, b, v) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const TAU = Math.PI * 2;

// the schedule (see above), in units relative to a garment's own k
const FLIGHT_IN = [-0.5, -0.02];
const SOLID_IN = [-0.04, 0.14];
const SOLID_OUT = [0.34, 0.46];
const SCATTER_END = 0.2; // the last flight ends this far past the last unit
const FLIGHT = 0.7; // the share of its window that one speck spends in the air
const HALO = 0.28; // how much of the dust stays visible over a solid drawing

const NB = 8; // brightness buckets: bronze in the shadows to champagne in the lights
const COLORS = Array.from({ length: NB }, (_, k) => {
  // bronze -> rich gold -> champagne, so the middle of the range is gold, not beige
  const f = k / (NB - 1);
  const [a, b, g] = f < 0.5 ? [[128, 82, 30], [228, 170, 68], f * 2] : [[228, 170, 68], [255, 241, 196], (f - 0.5) * 2];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * g)).join(',')})`;
});
const BUCKET_ALPHA = Array.from({ length: NB }, (_, k) => 0.34 + 0.66 * Math.pow(k / (NB - 1), 0.9));

const IDLE_MS = 45; // redraw interval while nothing moves (shimmer and float only)

// t() hands back the key itself while the strings are still loading
function label(key, fallback) {
  const text = t(key);
  return text === key ? fallback : text;
}

function make(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}

function init() {
  const stage = section.querySelector('.edit-stage');
  const sticky = section.querySelector('.edit-sticky');
  const rows = [...section.querySelectorAll('.edit-list > li')];
  if (!stage || !sticky || rows.length < 2) return false;
  const N = rows.length;

  const items = rows.map((li) => ({
    id: li.dataset.item,
    src: li.querySelector('img').getAttribute('src'),
    nameEl: li.querySelector('span'),
    fit: 1,
    c0x: 0.5,
    c0y: 0.5,
    pts: null // [x, y, brightness] triples, sorted
  }));
  const names = () => items.map((it) => it.nameEl.textContent.trim());

  /* ---- build the scene around the markup --------------------------------- */

  let built = null; // { nodes..., } once built
  function build() {
    if (built) return built;
    const B = {};
    B.bg = make('div', 'edit-bg');
    B.bg.setAttribute('aria-hidden', 'true');
    make('i', 'edit-glow', B.bg);
    make('i', 'edit-floor', B.bg);

    B.ghosts = make('div', 'edit-ghosts');
    B.ghosts.setAttribute('aria-hidden', 'true');
    B.ghost = items.map(() => {
      const g = make('div', 'edit-ghost', B.ghosts);
      g.inner = make('span', 'edit-ghost-in', g);
      return g;
    });

    B.solids = make('div', 'edit-solids');
    B.solids.setAttribute('aria-hidden', 'true');
    B.solid = items.map((it) => {
      const s = make('div', 'edit-solid', B.solids);
      s.art = make('div', 'edit-art', s);
      const img = make('img', '', s.art);
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.src = it.src;
      s.sheen = make('i', 'edit-sheen', s.art);
      s.sheen.style.setProperty('--m', `url(${it.src})`);
      return s;
    });

    B.canvas = make('canvas', 'edit-canvas');
    B.canvas.setAttribute('aria-hidden', 'true');

    B.ui = make('div', 'edit-ui');
    B.ui.setAttribute('aria-hidden', 'true');
    B.count = make('div', 'edit-count', B.ui);
    const row = make('div', 'edit-count-row', B.count);
    const nums = make('span', 'edit-nums', row);
    B.numsCol = make('span', 'edit-nums-col', nums);
    for (let k = 0; k < N; k++) make('b', '', B.numsCol).textContent = String(k + 1).padStart(2, '0');
    make('span', 'edit-of', row).textContent = `/ ${String(N).padStart(2, '0')}`;
    B.bar = make('i', 'edit-bar', B.count);
    B.barFill = make('i', '', B.bar);

    B.caption = make('div', 'edit-caption', B.ui);
    const nameBox = make('div', 'edit-names', B.caption);
    B.name = items.map(() => make('h3', 'edit-name', nameBox));
    B.sub = make('p', 'edit-sub', B.caption);
    B.hint = make('div', 'edit-hint', B.ui);
    B.hintText = make('span', '', B.hint);
    make('i', '', B.hint);

    B.dots = make('nav', 'edit-dots');
    B.dots.setAttribute('aria-hidden', 'true'); // pointer shortcut; keyboard and screen readers scroll or read the list
    B.dot = items.map((it, k) => {
      const b = make('button', 'edit-dot', B.dots);
      b.type = 'button';
      b.tabIndex = -1;
      b.addEventListener('click', () => goTo(k));
      return b;
    });

    stage.insertBefore(B.bg, stage.firstChild);
    stage.insertBefore(B.ghosts, B.bg.nextSibling);
    stage.insertBefore(B.solids, B.ghosts.nextSibling);
    stage.insertBefore(B.canvas, B.solids.nextSibling);
    stage.insertBefore(B.ui, B.canvas.nextSibling);
    stage.appendChild(B.dots);
    built = B;
    return B;
  }

  function unbuild() {
    if (!built) return;
    [built.bg, built.ghosts, built.solids, built.canvas, built.ui, built.dots].forEach((n) => n.remove());
    built = null;
  }

  /* ---- the art: sample every drawing for dust -------------------------------- */

  const P = coarse.matches || window.innerWidth < 700 ? 2600 : 4200; // specks
  let art = 'idle'; // idle -> loading -> ready | failed

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadArt() {
    if (art !== 'idle') return;
    art = 'loading';
    const size = 240;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d', { willReadFrequently: true });
    if (!g) {
      art = 'failed';
      return;
    }
    for (let k = 0; k < N; k++) {
      const img = await loadImage(items[k].src);
      if (!img) {
        art = 'failed';
        return;
      }
      g.fillStyle = '#000';
      g.fillRect(0, 0, size, size);
      g.drawImage(img, 0, 0, size, size);
      const raw = samplePicture(cv, P, seededRandom(1013 + k * 7919), 1.2);
      // sort: bands from the top down, left to right inside a band, so that
      // speck i is near the top of every shape when i is small
      const order = Array.from({ length: P }, (_, i) => i);
      order.sort((a, b) => {
        const d = Math.floor(raw[a * 3 + 1] * 14) - Math.floor(raw[b * 3 + 1] * 14);
        return d || raw[a * 3] - raw[b * 3];
      });
      const pts = new Float32Array(P * 3);
      let x0 = 1;
      let x1 = 0;
      let y0 = 1;
      let y1 = 0;
      for (let i = 0; i < P; i++) {
        const o = order[i] * 3;
        pts[i * 3] = raw[o];
        pts[i * 3 + 1] = raw[o + 1];
        pts[i * 3 + 2] = raw[o + 2];
        x0 = Math.min(x0, raw[o]);
        x1 = Math.max(x1, raw[o]);
        y0 = Math.min(y0, raw[o + 1]);
        y1 = Math.max(y1, raw[o + 1]);
      }
      const it = items[k];
      it.pts = pts;
      it.c0x = (x0 + x1) / 2;
      it.c0y = (y0 + y1) / 2;
      it.fit = clamp(Math.min(0.88 / Math.max(0.05, x1 - x0), 0.88 / Math.max(0.05, y1 - y0)), 0.85, 1.4);
    }
    art = 'ready';
  }

  /* ---- the dust --------------------------------------------------------------- */

  const rnd = seededRandom(7);
  const delay = new Float32Array(P); // 0..1: the top of a shape forms first
  const swirl = new Float32Array(P);
  const size = new Float32Array(P);
  const freq = new Float32Array(P);
  const phase = new Float32Array(P);
  const sa = [new Float32Array(P), new Float32Array(P), new Float32Array(P), new Float32Array(P)]; // scatter fields: angle, radius (start, end)
  for (let i = 0; i < P; i++) {
    delay[i] = 0.55 * (i / P) + 0.45 * rnd();
    swirl[i] = (rnd() - 0.5) * 0.9;
    size[i] = 0.85 + rnd() * rnd() * 1.7 + rnd() * 0.4;
    freq[i] = 0.6 + rnd() * 1.1;
    phase[i] = rnd() * TAU;
    sa[0][i] = rnd() * TAU;
    sa[1][i] = Math.sqrt(0.12 + 0.88 * rnd());
    sa[2][i] = rnd() * TAU;
    sa[3][i] = Math.sqrt(0.12 + 0.88 * rnd());
  }
  // way points: 0 = scattered, 1..N = the garments, N + 1 = scattered again
  const QX = Array.from({ length: N + 2 }, () => new Float32Array(P));
  const QY = Array.from({ length: N + 2 }, () => new Float32Array(P));
  const QB = Array.from({ length: N + 2 }, () => new Uint8Array(P));
  const BX = Array.from({ length: NB }, () => new Float32Array(P));
  const BY = Array.from({ length: NB }, () => new Float32Array(P));
  const BS = Array.from({ length: NB }, () => new Float32Array(P));
  const counts = new Int32Array(NB);
  const POSX = new Float32Array(P);
  const POSY = new Float32Array(P);

  const SPARKS = 46;
  const sparkIdx = new Uint32Array(SPARKS);
  const sparkF = new Float32Array(SPARKS);
  const sparkP = new Float32Array(SPARKS);
  const sparkR = new Float32Array(SPARKS);
  for (let j = 0; j < SPARKS; j++) {
    sparkIdx[j] = Math.floor(rnd() * P);
    sparkF[j] = 0.0011 + rnd() * 0.0021;
    sparkP[j] = rnd() * TAU;
    sparkR[j] = 3 + rnd() * 5;
  }

  /* ---- layout ----------------------------------------------------------------- */

  let W = 1;
  let H = 1;
  let dpr = 1;
  let S = 300; // garment box, px
  let cx = 0;
  let cy = 0;
  let stickTop = 14;
  let unitPx = 600;
  let ctx = null;

  function placeWaypoints() {
    if (art !== 'ready') return;
    const bx = cx - S / 2;
    const by = cy - S / 2;
    for (let k = 0; k < N; k++) {
      const it = items[k];
      const j = k + 1;
      for (let i = 0; i < P; i++) {
        const nx = it.pts[i * 3];
        const ny = it.pts[i * 3 + 1];
        QX[j][i] = bx + ((nx - it.c0x) * it.fit + 0.5) * S;
        QY[j][i] = by + ((ny - it.c0y) * it.fit + 0.5) * S;
        QB[j][i] = Math.min(NB - 1, Math.floor(Math.pow(it.pts[i * 3 + 2], 0.85) * NB));
      }
    }
    // a loose cloud over the card: more of it around the garment than far away
    for (const [w, a, r] of [[0, 0, 1], [N + 1, 2, 3]]) {
      for (let i = 0; i < P; i++) {
        const ang = sa[a][i];
        const rad = sa[r][i];
        QX[w][i] = cx + Math.cos(ang) * rad * W * 0.62;
        QY[w][i] = cy + Math.sin(ang) * rad * H * 0.58;
        QB[w][i] = QB[w === 0 ? 1 : N][i];
      }
    }
  }

  function fitGhosts() {
    if (!built) return;
    const base = Math.min(W * (W < 700 ? 0.62 : 0.3), H * 0.46); // as big as fits: short words get tall
    const maxW = W * 0.94;
    built.ghost.forEach((g) => {
      g.style.setProperty('--gfs', `${base}px`);
      const w = g.inner.getBoundingClientRect().width;
      if (w > maxW) g.style.setProperty('--gfs', `${(base * maxW) / w}px`);
    });
  }

  function layout() {
    if (!built) return;
    W = Math.max(1, stage.clientWidth);
    H = Math.max(1, stage.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, coarse.matches ? 1.5 : 1.75);
    built.canvas.width = Math.round(W * dpr);
    built.canvas.height = Math.round(H * dpr);

    const small = W < 700;
    S = small ? Math.min(W * 0.74, (H - 270) * 0.92) : Math.min(W * 0.34, (H - 240) * 0.92);
    S = Math.max(S, 150);
    cx = W / 2;
    cy = small ? H * 0.46 : H * 0.5 - 4;
    stage.style.setProperty('--cx', `${cx.toFixed(1)}px`);
    stage.style.setProperty('--cy', `${cy.toFixed(1)}px`);
    stage.style.setProperty('--S', `${S.toFixed(1)}px`);

    built.solid.forEach((s, k) => {
      const it = items[k];
      s.art.style.transform = `translate(${((0.5 - it.c0x * it.fit) * 100).toFixed(2)}%, ${((0.5 - it.c0y * it.fit) * 100).toFixed(2)}%) scale(${it.fit.toFixed(3)})`;
    });

    fitGhosts();
    placeWaypoints();

    const cs = getComputedStyle(sticky);
    stickTop = parseFloat(cs.top) || 0;
    unitPx = Math.max(100, (section.offsetHeight - sticky.offsetHeight) / N);
    last.idx = -1; // redo the labels
    wake();
  }

  /* ---- text ------------------------------------------------------------------- */

  function setTexts() {
    if (!built) return;
    const nm = names();
    nm.forEach((text, k) => {
      built.name[k].textContent = text;
      const g = built.ghost[k];
      g.inner.textContent = '';
      [...text].forEach((ch, i) => {
        const c = make('span', 'edit-ch', g.inner);
        c.style.setProperty('--i', i);
        c.textContent = ch === ' ' ? ' ' : ch;
      });
      built.dot[k].setAttribute('aria-label', text);
      built.dot[k].title = text;
    });
    built.sub.textContent = label('marquee_contact', 'Contact us to order');
    built.hintText.textContent = label('edit_hint', 'Keep scrolling');
    fitGhosts();
  }

  /* ---- scroll -> u -------------------------------------------------------------- */

  function target() {
    const r = section.getBoundingClientRect();
    return clamp((stickTop - r.top) / unitPx, -3, N + 1.5);
  }

  function goTo(k) {
    const r = section.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - stickTop + (k + 0.22) * unitPx, behavior: 'smooth' });
  }

  /* ---- one frame ---------------------------------------------------------------- */

  const last = { idx: -1, p: -1, hint: null, glow: -1, floor: -1, solid: new Array(N).fill(-1), sh: new Array(N).fill(-1) };
  let quality = 1;
  let slow = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function updateSolids(u, now) {
    const fy = Math.sin(now * 0.0012) * 4;
    const fr = Math.sin(now * 0.0008) * 0.5;
    let top = 0;
    let pulse = 0;
    for (let k = 0; k < N; k++) {
      const el = built.solid[k];
      const o = ss(k + SOLID_IN[0], k + SOLID_IN[1], u) * (1 - ss(k + SOLID_OUT[0], k + SOLID_OUT[1], u));
      if (o <= 0.002) {
        if (last.solid[k] !== 0) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          last.solid[k] = 0;
        }
        continue;
      }
      const inn = ss(k + SOLID_IN[0], k + SOLID_IN[1], u);
      const out = ss(k + SOLID_OUT[0], k + SOLID_OUT[1], u);
      const sc = 0.9 + 0.1 * inn + 0.035 * out;
      el.style.visibility = 'visible';
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(${(pointer.x * 7).toFixed(2)}px, ${(fy + (1 - inn) * 22 + pointer.y * 5).toFixed(2)}px, 0) scale(${sc.toFixed(4)}) rotate(${(fr + (1 - inn) * -2.5).toFixed(3)}deg)`;
      // a light sweep across the foil as it appears, and another as it goes
      const sweepIn = clamp((u - (k + SOLID_IN[0])) / 0.4, 0, 1);
      const sweepOut = clamp((u - (k + SOLID_OUT[0] - 0.05)) / 0.3, 0, 1);
      const sh = sweepOut > 0 ? 1 - sweepOut : sweepIn;
      const sho = sweepOut > 0 ? Math.sin(Math.PI * sweepOut) : Math.sin(Math.PI * sweepIn);
      el.sheen.style.setProperty('--sh', sh.toFixed(3));
      el.sheen.style.setProperty('--sho', (sho * 0.85).toFixed(3));
      last.solid[k] = o;
      if (o > top) top = o;
      pulse = Math.max(pulse, Math.sin(Math.PI * inn) * (1 - out));
    }
    return { top, pulse };
  }

  function drawDust(u, now, solid) {
    if (!ctx || art !== 'ready') return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const aBase = 1 - (1 - HALO) * solid;
    const tIdx = clamp(Math.floor(u + 0.5), 0, N);
    const w0 = tIdx + FLIGHT_IN[0];
    const w1 = tIdx < N ? tIdx + FLIGHT_IN[1] : N + SCATTER_END;
    const L = w1 - w0;
    const fx = QX[tIdx];
    const fy = QY[tIdx];
    const tx = QX[tIdx + 1];
    const ty = QY[tIdx + 1];
    const fb = QB[tIdx];
    const tb = QB[tIdx + 1];
    const parX = pointer.x * 12;
    const parY = pointer.y * 8 + Math.sin(now * 0.0012) * 4;
    counts.fill(0);
    const stepSkip = quality < 0.6 ? 2 : quality < 0.9 ? 3 : 0; // thin out evenly
    const span = FLIGHT * L;
    const free = (1 - FLIGHT) * L;
    for (let i = 0; i < P; i++) {
      if (stepSkip && i % stepSkip === stepSkip - 1) continue;
      const e = clamp((u - (w0 + delay[i] * free)) / span, 0, 1);
      const ee = e * e * (3 - 2 * e);
      const sx = fx[i];
      const sy = fy[i];
      const dx = tx[i] - sx;
      const dy = ty[i] - sy;
      const arc = Math.sin(Math.PI * ee) * swirl[i];
      let x = sx + dx * ee - dy * arc;
      let y = sy + dy * ee + dx * arc;
      // loose specks drift about; once in a garment they only shimmer
      const loose = (tIdx === 0 ? 1 - ee : tIdx === N ? ee : 0) + Math.sin(Math.PI * ee) * 0.6;
      const ph = phase[i];
      const fq = freq[i];
      x += Math.sin(now * 0.0004 * fq + ph) * 9 * loose + Math.sin(now * 0.0019 * fq + ph) * 0.55 + parX;
      y += Math.cos(now * 0.00033 * fq + ph) * 8 * loose + Math.cos(now * 0.0016 * fq + ph) * 0.55 + parY;
      POSX[i] = x;
      POSY[i] = y;
      const b = e < 0.5 ? fb[i] : tb[i];
      const c = counts[b]++;
      BX[b][c] = x;
      BY[b][c] = y;
      BS[b][c] = size[i] * (1 + 0.35 * Math.sin(Math.PI * ee)) * (0.82 + 0.05 * b);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < NB; b++) {
      const c = counts[b];
      if (!c) continue;
      const a = aBase * BUCKET_ALPHA[b] * (0.9 + 0.1 * Math.sin(now * 0.002 + b * 1.3));
      if (a < 0.01) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = COLORS[b];
      ctx.beginPath();
      const xs = BX[b];
      const ys = BY[b];
      const zs = BS[b];
      for (let k = 0; k < c; k++) ctx.rect(xs[k] - zs[k] / 2, ys[k] - zs[k] / 2, zs[k], zs[k]);
      ctx.fill();
    }
    // a few specks twinkle as four-point stars
    ctx.fillStyle = '#fff3cf';
    for (let j = 0; j < SPARKS; j++) {
      const tw = Math.sin(now * sparkF[j] + sparkP[j]);
      if (tw < 0.35) continue;
      const k = (tw - 0.35) / 0.65;
      const i = sparkIdx[j];
      const r = sparkR[j] * (0.5 + 0.5 * k);
      const x = POSX[i];
      const y = POSY[i];
      ctx.globalAlpha = Math.min(1, k * k * (0.55 + 0.45 * solid));
      ctx.fillRect(x - r, y - 0.6, r * 2, 1.2);
      ctx.fillRect(x - 0.6, y - r, 1.2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function updateLabels(u, solid, pulse) {
    const idx = clamp(Math.floor(u + 1e-6), 0, N - 1);
    if (idx !== last.idx) {
      last.idx = idx;
      built.ghost.forEach((g, k) => {
        g.classList.toggle('is-active', k === idx);
        g.classList.toggle('is-before', k < idx);
      });
      built.name.forEach((n, k) => {
        n.classList.toggle('is-active', k === idx);
        n.classList.toggle('is-before', k < idx);
      });
      built.dot.forEach((d, k) => d.classList.toggle('is-active', k === idx));
      built.numsCol.style.setProperty('--idx', idx);
    }
    const p = clamp(u / (N - 0.5), 0, 1);
    if (Math.abs(p - last.p) > 0.002) {
      last.p = p;
      built.barFill.style.setProperty('--p', p.toFixed(3));
    }
    const hint = u > 0 && u < 0.75;
    if (hint !== last.hint) {
      last.hint = hint;
      built.hint.classList.toggle('is-on', hint);
    }
    const glow = clamp(0.12 + 0.7 * solid + 0.3 * pulse, 0, 1);
    if (Math.abs(glow - last.glow) > 0.004) {
      last.glow = glow;
      stage.style.setProperty('--glow', glow.toFixed(3));
    }
    if (Math.abs(solid - last.floor) > 0.004) {
      last.floor = solid;
      stage.style.setProperty('--floor', solid.toFixed(3));
    }
    built.ghosts.style.setProperty('--gx', (-pointer.x * 16).toFixed(2));
    built.ghosts.style.setProperty('--gy', (-pointer.y * 9).toFixed(2));
  }

  /* ---- the loop --------------------------------------------------------------- */

  let cur = null; // the u being shown: eases toward the scroll position
  let raf = 0;
  let timer = 0;
  let prevT = 0;
  let active = false; // the scene is on (not reduced motion, tall enough)
  let inView = false;
  let wasMoving = false; // did the previous frame follow the scroll? (so dt is a frame time)

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = 0;
    timer = 0;
    wasMoving = false;
  }

  function wake() {
    if (!active || !inView || document.hidden || !built || raf) return;
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raf = 0;
    if (!active || !inView || !built) return;
    const dt = prevT ? Math.min(0.1, (now - prevT) / 1000) : 0.016;
    prevT = now;

    const want = target();
    if (cur === null) cur = want;
    else cur += (want - cur) * (1 - Math.exp(-dt * 9));
    if (Math.abs(want - cur) < 0.0005) cur = want;

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 6);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 6);

    const t0 = performance.now();
    const { top, pulse } = updateSolids(cur, now);
    drawDust(cur, now, top);
    updateLabels(cur, top, pulse);
    const cost = performance.now() - t0;

    // slow device: use fewer specks (never goes back up, so it can't flutter). Slow
    // is either our own work taking long or, on a phone that rasterizes the canvas
    // on the CPU, frames arriving late (only judged between two frames in a row)
    if (!window.__editFixedQuality && cur !== want) {
      const late = wasMoving && dt > 0.028;
      slow = cost > 14 || late ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 24 && quality > 0.5) {
        quality = quality > 0.9 ? 0.67 : 0.5;
        slow = 0;
      }
    }

    const moving = cur !== want || Math.abs(pointer.tx - pointer.x) > 0.004 || Math.abs(pointer.ty - pointer.y) > 0.004;
    wasMoving = cur !== want;
    if (moving) raf = requestAnimationFrame(tick);
    else timer = setTimeout(() => {
      timer = 0;
      if (!raf && active && inView && !document.hidden) raf = requestAnimationFrame(tick);
    }, IDLE_MS);
  }

  /* ---- switching on and off ------------------------------------------------------ */

  function enable() {
    if (active) return;
    active = true;
    root.classList.add('edit-armed');
    build();
    setTexts();
    section.style.setProperty('--edit-n', N);
    ctx = built.canvas.getContext('2d');
    section.classList.add('edit--live');
    layout();
    loadArt().then(() => {
      if (!active) return;
      placeWaypoints();
      cur = null;
      wake();
    });
    wake();
  }

  function disable() {
    if (!active && !built) {
      root.classList.remove('edit-armed');
      return;
    }
    active = false;
    stop();
    unbuild();
    ctx = null;
    cur = null;
    section.classList.remove('edit--live');
    root.classList.remove('edit-armed');
  }

  function evaluate() {
    if (reduced.matches || !tall.matches) disable();
    else enable();
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) {
          prevT = 0;
          wake();
        } else stop();
      },
      { rootMargin: '15% 0px' } // wake a little before the card slides in, but sleep again at the page bottom
    ).observe(section);
  } else {
    inView = true;
  }

  window.addEventListener('scroll', wake, { passive: true });
  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (active) layout();
    });
  };
  window.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(stage);

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !active) return;
    const r = stage.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    wake();
  });
  stage.addEventListener('pointerleave', () => {
    pointer.tx = 0;
    pointer.ty = 0;
    wake();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else {
      prevT = 0;
      wake();
    }
  });
  document.addEventListener('translations-ready', () => {
    setTexts();
    wake();
  });
  if (document.fonts) document.fonts.ready.then(() => active && (fitGhosts(), wake()));
  reduced.addEventListener('change', evaluate);
  tall.addEventListener('change', evaluate);

  evaluate();
  return true;
}

if (section) {
  try {
    if (!init()) root.classList.remove('edit-armed');
  } catch (err) {
    // never leave a half-built scene behind: the still grid is the fallback
    console.error('edit-scene:', err);
    root.classList.remove('edit-armed');
    section.classList.remove('edit--live');
  }
}
