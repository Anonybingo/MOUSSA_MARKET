// The kinetic intro of the home hero, drawn on the hero's canvas.
//
// What happens (times in seconds on the intro clock, see TL below). The motion
// was measured frame by frame from the reel the user supplied (30 fps), then
// re-skinned: gold chrome on espresso instead of white on black, and the
// brand's own words.
//
//   0.06  a dot drops from above, squashes on the floor, bounces once (to 15%
//         of the fall), lands again and settles
//   0.79  a stem drops in and lands ON the dot, squashes, and springs up to
//         rest a little above it: together they read as "!"
//   1.13  the stem swings about its foot: out to the left, then it snaps across
//         to the right and stays there, leaning
//   1.28  out of that pivot the letters H, A, K are thrown, tumbling, to the
//         left, and land on the baseline; a few sparks follow the stem's lean
//   1.92  the stem straightens into the "I" of HAKI, the dot shrinks away, and
//         the word glides to the middle
//   2.42  the word is swapped one letter at a time with hard cuts, re-centring
//         on every cut:  HAKI > BAKI > BOKI > BOUI > BOUT > BOUTI > … > BOUTIQUE
//   3.28  BOUTIQUE slides down to where the page layout wants it (that position
//         is measured from the DOM, see measure())
//
// Everything here is a pure function of the clock `T` and of the geometry given
// to measure(): the same T always draws the same picture, which is what makes
// the intro scrubbable (hero-fx.js drives T from a Web Animations clock) and
// testable frame by frame. Nothing here touches the DOM except to make
// off-screen canvases.

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (T, a, b) => clamp01((T - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t, s = 1.70158) => {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};
// 1 at τ = 0, easing to 0 at τ = d (a squash that springs back)
const pulse = (tau, d) => (tau < 0 || tau > d ? 0 : (1 - tau / d) * (1 - tau / d));

export const WORDS = ['HAKI', 'BAKI', 'BOKI', 'BOUI', 'BOUT', 'BOUTI', 'BOUTIQ', 'BOUTIQU', 'BOUTIQUE'];

// The timeline. The DOM reveals (copy, search) are timed in css/style.css as
// plain seconds — keep the two in step (look for "hero-reveal" there).
export const TL = {
  dotFall: [0.062, 0.24], // lands at 0.24 and stays squashed until holdEnd
  dotHoldEnd: 0.31,
  dotUp: [0.31, 0.47],
  dotDown: [0.47, 0.655],
  stemFall: [0.79, 0.9], // lands on the dot at 0.90
  stemSquash: [0.9, 0.967],
  stemRise: [0.967, 1.1],
  letters: 1.28, // first letter out; the next ones follow a few frames later
  lettersGap: 0.03,
  iForm: [1.92, 2.04],
  dotShrink: [1.98, 2.22],
  glide: [2.0, 2.3],
  dip: [2.35, 2.42],
  morph: 2.42,
  morphStep: 0.085,
  slide: [3.28, 3.82],
  sheen: 4.05,
  dustIn: [3.8, 4.55],
  converge: 4.35,
  end: 6.3
};

// how the stem swings about its foot: [time, degrees]. Out to the left, a beat
// there, a snap across to the right where it leans while the letters fly, then
// upright again to become the I.
const SWING = [
  [1.13, 0],
  [1.21, -66],
  [1.27, -66],
  [1.33, 62],
  [1.8, 72],
  [1.92, 0]
];

const FONT = (px) => `800 ${px}px Poppins, Inter, system-ui, sans-serif`;
const CHROME = [
  [0, '#fff6dc'],
  [0.42, '#f4c96e'],
  [0.64, '#dca543'],
  [1, '#a56f26']
];

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// a soft round light, drawn scaled and added to what is already there
function makeGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,246,222,1)');
  gr.addColorStop(0.22, 'rgba(255,232,180,0.55)');
  gr.addColorStop(0.55, 'rgba(240,190,100,0.16)');
  gr.addColorStop(1, 'rgba(240,190,100,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  return c;
}

// fixed pseudo-random numbers for the sparks: the same sparks every time
function sparkSet(n) {
  let a = 7;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: n }, () => ({
    spread: (rnd() - 0.5) * 0.9, // radians either side of the stem's direction
    speed: 0.7 + rnd() * 1.3, // in font sizes per second
    size: 0.012 + rnd() * 0.02,
    delay: rnd() * 0.3,
    life: 0.35 + rnd() * 0.3,
    spin: (rnd() - 0.5) * 8
  }));
}

export function createIntro() {
  const mctx = document.createElement('canvas').getContext('2d');
  const glowSprite = makeGlow();
  const sparks = sparkSet(16);
  const gradCache = new WeakMap();
  let g = null; // geometry from the last measure()
  let face = null; // BOUTIQUE, pre-drawn: gold-chrome letters
  let shadow = null; // BOUTIQUE's soft dark shadow (it keeps the word readable over the dust)
  let tmp = null; // scratch for the sheen
  let tmpCtx = null;
  let keyN = 0;

  /* ---------------------------------------------------------------------
     geometry
     {W, H}   stage size (CSS px)          F       font size of the word
     cx       horizontal centre of the word baseY   its final baseline (stage y)
     dpr      device pixel ratio (for the pre-drawn word)
     --------------------------------------------------------------------- */
  function measure({ W, H, F, cx, baseY, dpr = 1 }) {
    mctx.font = FONT(F);
    mctx.textBaseline = 'alphabetic';
    const ls = -0.03 * F; // letter-spacing, matches the CSS
    const capH = mctx.measureText('H').actualBoundingBoxAscent || 0.7 * F;
    const mi = mctx.measureText('I');
    const iL = mi.actualBoundingBoxLeft != null ? -mi.actualBoundingBoxLeft : 0.05 * F;
    const iR = mi.actualBoundingBoxRight != null ? mi.actualBoundingBoxRight : 0.25 * F;

    const adv = {};
    const half = {};
    for (const ch of new Set(WORDS.join(''))) {
      const w = mctx.measureText(ch).width;
      adv[ch] = w + ls;
      half[ch] = w / 2;
    }
    const layouts = {};
    for (const word of WORDS) {
      const p = [];
      let x = 0;
      for (const ch of word) {
        p.push(x);
        x += adv[ch];
      }
      layouts[word] = { p, tw: x - ls };
    }

    const iIdx = WORDS[0].indexOf('I');
    // where the intro word sits: a little above the middle, and always above the
    // final baseline so the slide goes down
    const yb0 = Math.max(1.05 * F, Math.min(H * 0.52, baseY - 0.07 * H));
    const r = 0.105 * F;
    const gap = 0.14 * F; // stem foot to the top of the dot
    g = {
      key: ++keyN,
      W,
      H,
      F,
      cx,
      baseY,
      dpr,
      capH,
      ls,
      adv,
      half,
      layouts,
      iIdx,
      stemW: Math.max(0.1 * F, iR - iL),
      stemH: 1.1 * capH, // the reel's stem is a little longer than a capital
      yb0,
      r,
      gap,
      dotTop: yb0 + gap,
      dotFloor: yb0 + gap + 2 * r, // y of the dot's lowest point when it rests
      // offset that puts the I of HAKI at the centre of the stage
      X0: cx - (layouts[WORDS[0]].p[iIdx] + half.I),
      finalWord: WORDS[WORDS.length - 1]
    };
    g.finalTW = layouts[g.finalWord].tw;
    buildCaches();
  }

  // The finished word is drawn many times (every frame, sliding) so it is drawn
  // once into canvases of its own: the letters, and a separate soft shadow that
  // fades in with the dust.
  function buildCaches() {
    const { F, dpr, capH } = g;
    const L = g.layouts[g.finalWord];
    const pad = Math.ceil(F * 0.4);
    const base = pad + Math.ceil(capH * 1.04); // baseline inside the pre-drawn canvas
    const w = Math.ceil(L.tw + pad * 2);
    const h = Math.ceil(base + 0.32 * F + pad); // room for the tail of the Q
    const pw = Math.ceil(w * dpr);
    const ph = Math.ceil(h * dpr);

    const mk = () => {
      const c = document.createElement('canvas');
      c.width = pw;
      c.height = ph;
      return c;
    };
    face = mk();
    const f = face.getContext('2d');
    f.scale(dpr, dpr);
    f.font = FONT(F);
    f.textBaseline = 'alphabetic';
    const gr = f.createLinearGradient(0, base - capH, 0, base);
    for (const [s, c] of CHROME) gr.addColorStop(s, c);
    f.fillStyle = gr;
    for (let k = 0; k < g.finalWord.length; k++) f.fillText(g.finalWord[k], pad + L.p[k], base);

    // shadow only: the letters are drawn far off to the left and their shadow is
    // offset back by the same amount, so it lands on the canvas without them
    shadow = mk();
    const s = shadow.getContext('2d');
    const FAR = pw + 2000;
    s.font = FONT(F * dpr);
    s.textBaseline = 'alphabetic';
    s.shadowColor = 'rgba(8,4,2,0.8)';
    s.shadowBlur = 0.15 * F * dpr;
    s.shadowOffsetX = FAR;
    s.shadowOffsetY = 0.035 * F * dpr;
    s.fillStyle = '#000';
    for (let k = 0; k < g.finalWord.length; k++) s.fillText(g.finalWord[k], (pad + L.p[k]) * dpr - FAR, base * dpr);

    tmp = mk();
    tmpCtx = tmp.getContext('2d');
    g.cache = { w, h, pad, base };
  }

  // gradients are tied to the geometry; keep one set per context
  function gradsFor(ctx) {
    let o = gradCache.get(ctx);
    if (o && o.key === g.key) return o;
    const gr = ctx.createLinearGradient(0, -g.capH / 2, 0, g.capH / 2);
    for (const [s, c] of CHROME) gr.addColorStop(s, c);
    o = { key: g.key, letter: gr };
    gradCache.set(ctx, o);
    return o;
  }

  /* ---------------------------------------------------------------------
     the parts
     --------------------------------------------------------------------- */

  function glowAt(ctx, x, y, radius, alpha) {
    if (alpha < 0.004 || radius < 1) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glowSprite, x - radius, y - radius, radius * 2, radius * 2);
  }

  // The dot: falls at close to constant speed (stretched), flattens on the
  // floor for a few frames, bounces to 15% of the fall, lands again with a
  // smaller flattening. It squashes about its centre, as in the reel.
  function dotPose(T) {
    if (T < TL.dotFall[0]) return null;
    const k = 1 - easeInOut(seg(T, TL.dotShrink[0], TL.dotShrink[1]));
    if (k <= 0.002) return null;

    const r = g.r;
    const floor = g.dotFloor;
    const start = -2.5 * r; // lowest point of the dot when it first appears: above the stage
    const hb = 0.15 * (floor - start);
    let bottom = floor;
    let sx = 1;
    let sy = 1;
    if (T < TL.dotFall[1]) {
      const e = seg(T, TL.dotFall[0], TL.dotFall[1]);
      bottom = lerp(start, floor, Math.pow(e, 1.1));
      sy = 1 + 0.2 * e; // stretched by its speed
      sx = 1 / Math.sqrt(sy);
    } else if (T >= TL.dotUp[0] && T < TL.dotUp[1]) {
      const e = seg(T, TL.dotUp[0], TL.dotUp[1]);
      bottom = floor - hb * (1 - (1 - e) * (1 - e));
    } else if (T >= TL.dotDown[0] && T < TL.dotDown[1]) {
      const e = seg(T, TL.dotDown[0], TL.dotDown[1]);
      bottom = floor - hb * (1 - e * e);
    } else if (T >= TL.dotUp[1] && T < TL.dotDown[0]) {
      bottom = floor - hb;
    }
    let sq = 0;
    if (T >= TL.dotFall[1] && T < TL.dotHoldEnd) sq = 1;
    else if (T >= TL.dotHoldEnd) sq = 1 - smooth(seg(T, TL.dotHoldEnd, TL.dotHoldEnd + 0.04));
    sq += 0.6 * pulse(T - TL.dotDown[1], 0.07);
    sx *= 1 + 0.45 * sq;
    sy *= 1 - 0.45 * sq;
    return { x: g.cx, cy: bottom - r, sx: sx * k, sy: sy * k, k };
  }

  function drawDot(ctx, p, A) {
    const r = g.r;
    ctx.save();
    ctx.globalAlpha = A;
    ctx.translate(p.x, p.cy);
    ctx.scale(p.sx, p.sy);
    const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    gr.addColorStop(0, '#fffdf6');
    gr.addColorStop(0.62, '#fbe3ab');
    gr.addColorStop(1, '#e4b455');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function swingAngle(T) {
    if (T <= SWING[0][0]) return 0;
    for (let i = 1; i < SWING.length; i++) {
      if (T <= SWING[i][0]) {
        const [t0, a0] = SWING[i - 1];
        const [t1, a1] = SWING[i];
        const u = (T - t0) / (t1 - t0);
        const e = i === 1 ? easeOutCubic(u) : i === 3 ? easeInOut(u) : smooth(u);
        return (lerp(a0, a1, e) * Math.PI) / 180;
      }
    }
    return 0;
  }

  // The stem's foot position and shape at time T, or null when it isn't there.
  function stemPose(T) {
    if (T < TL.stemFall[0] || T >= TL.iForm[1]) return null;
    const { yb0, capH } = g;
    let h = g.stemH;
    let bottom;
    let sx = 1;
    let sy = 1;
    let ang = 0;
    let rad = 0.2 * g.stemW;
    if (T < TL.stemFall[1]) {
      bottom = lerp(0, g.dotTop, seg(T, TL.stemFall[0], TL.stemFall[1]));
      sy = 1.06; // a touch stretched at speed
      sx = 0.97;
    } else if (T < TL.stemSquash[1]) {
      bottom = g.dotTop; // on the dot, squashed against it
      const s = Math.sin(Math.PI * seg(T, TL.stemSquash[0], TL.stemSquash[1]));
      sy = 1 - 0.27 * s;
      sx = 1 + 0.3 * s;
    } else {
      // springs up off the dot to its resting height, a little past it
      const u = seg(T, TL.stemRise[0], TL.stemRise[1]);
      bottom = lerp(g.dotTop, yb0, easeOutBack(u, 1.4));
      ang = swingAngle(T);
    }
    if (T >= TL.iForm[0]) {
      const u = easeOutCubic(seg(T, TL.iForm[0], TL.iForm[1]));
      h = lerp(g.stemH, capH, u);
      rad = lerp(rad, 0, u);
    }
    return { bottom, h, sx, sy, ang, rad };
  }

  function drawStem(ctx, p, A) {
    const w = g.stemW;
    ctx.save();
    ctx.globalAlpha = A;
    ctx.translate(g.cx, p.bottom);
    if (p.ang) ctx.rotate(p.ang);
    ctx.scale(p.sx, p.sy);
    const gr = ctx.createLinearGradient(0, -p.h, 0, 0);
    for (const [s, c] of CHROME) gr.addColorStop(s, c);
    ctx.fillStyle = gr;
    roundRect(ctx, -w / 2, -p.h, w, p.h, p.rad);
    ctx.fill();
    ctx.restore();
  }

  // one glyph, drawn about the centre of its box
  function glyph(ctx, ch, x, y, rot, sx, sy, a) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    ctx.globalAlpha = a;
    ctx.fillStyle = gradsFor(ctx).letter;
    ctx.fillText(ch, -g.half[ch], g.capH / 2);
    ctx.restore();
  }

  // Where letter k of the intro word is at time T, or null before it is out.
  // They come out of the stem's foot together (a few frames apart); the farther
  // a letter has to go, the longer it flies. They tumble about the page and
  // about a vertical axis like coins, arc up and land on the baseline.
  function letterPose(k, T, offX) {
    const L = g.layouts[WORDS[0]];
    const ch = WORDS[0][k];
    const order = g.iIdx - 1 - k; // 0 = the letter next to the I (letters are all left of it)
    const start = TL.letters + order * TL.lettersGap;
    if (T < start) return null;
    const dur = 0.25 + 0.055 * order;
    const fx = offX + L.p[k] + g.half[ch];
    const fy = g.yb0 - g.capH / 2;
    const e = seg(T, start, start + dur);
    if (e >= 1) return { ch, x: fx, y: fy, rot: 0, sx: 1, sy: 1, a: 1, e: 1 };

    const F = g.F;
    const ee = easeOutCubic(e);
    const x = lerp(g.cx, fx, ee);
    const y = lerp(g.yb0 - 0.2 * F, fy, e) - 4 * e * (1 - e) * (0.3 + 0.12 * order) * F;
    const spin = 1 - easeOutBack(e, 0.9);
    const rot = -Math.PI * (1.15 + 0.3 * order) * spin;
    const phi = -TAU * (0.8 + 0.3 * order) * (1 - ee);
    const flat = 0.55 + 0.45 * Math.abs(Math.cos(phi));
    const s = lerp(0.55, 1, easeOutCubic(clamp01(e / 0.5)));
    return { ch, x, y, rot, sx: s * flat, sy: s, a: clamp01(e / 0.08), e };
  }

  function dipFactor(T) {
    return 1 - 0.65 * Math.sin(Math.PI * seg(T, TL.dip[0], TL.dip[1]));
  }

  // sparks thrown along the leaning stem while it holds its lean
  function drawSparks(ctx, T, A) {
    const t0 = 1.45;
    if (T < t0 || T > t0 + 0.9) return;
    const { F, cx, yb0 } = g;
    const dir = swingAngle(Math.min(T, 1.8)); // radians; 0 = straight up, positive = leaning right
    for (const s of sparks) {
      const u = (T - t0 - s.delay) / s.life;
      if (u <= 0 || u >= 1) continue;
      const a = dir + s.spread;
      const d = s.speed * F * (1 - (1 - u) * (1 - u)) * 0.5 + 0.35 * F;
      const x = cx + Math.sin(a) * d;
      const y = yb0 - Math.cos(a) * d;
      const sz = s.size * F * (1 - 0.5 * u);
      ctx.save();
      ctx.globalAlpha = A * (1 - u) * (1 - u) * 0.9;
      ctx.translate(x, y);
      ctx.rotate(s.spin * u);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(-sz, -sz * 0.35, sz * 2, sz * 0.7);
      ctx.restore();
    }
  }

  // A sheen: a slanted band of light that crosses the finished word, clipped to
  // the letters (the band is painted on a scratch canvas, then masked with the word).
  function drawSheen(ctx, x, y, p, A) {
    const { w, h } = g.cache;
    const dpr = g.dpr;
    const t = tmpCtx;
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = 'source-over';
    t.globalAlpha = 1;
    t.clearRect(0, 0, tmp.width, tmp.height);
    const bw = w * 0.16 * dpr;
    const bx = lerp(-bw, w * dpr + bw, easeInOut(p));
    t.setTransform(1, 0, -0.3, 1, 0, 0);
    const gr = t.createLinearGradient(bx - bw, 0, bx + bw, 0);
    gr.addColorStop(0, 'rgba(255,250,235,0)');
    gr.addColorStop(0.5, 'rgba(255,250,235,0.9)');
    gr.addColorStop(1, 'rgba(255,250,235,0)');
    t.fillStyle = gr;
    t.fillRect(-h * dpr, 0, w * dpr + 2 * h * dpr, h * dpr);
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(face, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = A * 0.8;
    ctx.drawImage(tmp, x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------------------
     draw one frame.  S: { fade, lift, sheen }
       fade   0…1, the scroll-away fade of the whole thing (default 1)
       lift   px the whole thing is moved down by (default 0)
       sheen  0…1 to run the sheen at that progress (the clock runs the first
              one itself; hero-fx.js asks for the occasional later ones)
     --------------------------------------------------------------------- */
  function draw(ctx, T, S = {}) {
    if (!g) return;
    const A = S.fade == null ? 1 : S.fade;
    if (A < 0.004) return;
    const { F, cx, yb0, capH } = g;
    const dustIn = smooth(seg(T, TL.dustIn[0], TL.dustIn[1]));

    ctx.save();
    if (S.lift) ctx.translate(0, S.lift);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = FONT(F);

    const inIntro = T < TL.morph;
    const L0 = g.layouts[WORDS[0]];
    const glide = easeInOut(seg(T, TL.glide[0], TL.glide[1]));
    const offX = lerp(g.X0, cx - L0.tw / 2, glide);
    const mid = yb0 - capH / 2;
    const dot = dotPose(T);
    const stem = stemPose(T);

    /* ---- 1. lights (added to what is behind them) ---- */
    ctx.globalCompositeOperation = 'lighter';
    // a faint halo behind the whole intro, like the reel's grey disc
    glowAt(ctx, cx, mid, 2.3 * F, A * 0.09 * smooth(seg(T, 0.2, 0.9)) * (1 - smooth(seg(T, 3.3, 4.0))));

    // [time, rise, duration, radius (× F), strength, x, y]: each flash ramps up
    // for `rise` seconds, then fades out
    const flashes = [
      [0.25, 0.03, 0.34, 1.0, 0.4, cx, g.dotFloor - g.r],
      [0.655, 0.02, 0.22, 0.6, 0.2, cx, g.dotFloor - g.r],
      [0.9, 0.03, 0.5, 1.5, 0.62, cx, g.dotTop],
      [1.97, 0.02, 0.36, 1.1, 0.3, cx, mid]
    ];
    for (const [t, rise, d, R, a, x, y] of flashes) {
      const e = T - t;
      if (e < 0 || e > d) continue;
      const ramp = clamp01(e / rise);
      const fall = 1 - clamp01((e - rise) / (d - rise));
      glowAt(ctx, x, y, R * F, A * a * ramp * fall * fall);
    }
    // a steady glow at the pivot while the letters are thrown out
    const sw = seg(T, 1.25, 1.95);
    if (sw > 0 && sw < 1) glowAt(ctx, cx, yb0 - 0.1 * F, 1.0 * F, A * 0.2 * Math.sin(Math.PI * sw));
    if (dot) glowAt(ctx, dot.x, dot.cy, g.r * 3.4 * dot.k, A * 0.25 * dot.k);
    if (inIntro) {
      for (let k = 0; k < g.iIdx; k++) {
        const p = letterPose(k, T, offX);
        if (p && p.e < 1) glowAt(ctx, p.x, p.y, 0.8 * F * (0.5 + 0.5 * (1 - p.e)), A * 0.45 * Math.pow(1 - p.e, 1.2) * clamp01(p.e / 0.08));
      }
      drawSparks(ctx, T, A);
    }
    ctx.globalCompositeOperation = 'source-over';

    /* ---- 2. the word ---- */
    if (inIntro) {
      if (dot) drawDot(ctx, dot, A);
      if (stem) drawStem(ctx, stem, A);
      const dip = dipFactor(T);
      for (let k = 0; k < WORDS[0].length; k++) {
        if (k === g.iIdx) {
          // the I is the stem until it has finished straightening; then it is a plain letter
          if (T >= TL.iForm[1]) glyph(ctx, 'I', offX + L0.p[k] + g.half.I, mid, 0, 1, 1, A * dip);
          continue;
        }
        const p = letterPose(k, T, offX);
        if (p) glyph(ctx, p.ch, p.x, p.y, p.rot, p.sx, p.sy, A * p.a * dip);
      }
    } else {
      const idx = Math.min(WORDS.length - 1, Math.floor((T - TL.morph) / TL.morphStep));
      const text = WORDS[idx];
      const slide = easeInOut(seg(T, TL.slide[0], TL.slide[1]));
      const baseline = lerp(yb0, g.baseY, slide);
      const L = g.layouts[text];
      const x0 = cx - L.tw / 2;
      if (text !== g.finalWord) {
        for (let k = 0; k < text.length; k++) {
          glyph(ctx, text[k], x0 + L.p[k] + g.half[text[k]], baseline - capH / 2, 0, 1, 1, A);
        }
      } else {
        const { w, h, pad, base } = g.cache;
        const dpr = g.dpr;
        const x = Math.round((x0 - pad) * dpr) / dpr;
        const y = Math.round((baseline - base) * dpr) / dpr;
        if (dustIn > 0) {
          ctx.globalAlpha = A * dustIn;
          ctx.drawImage(shadow, x, y, w, h);
        }
        ctx.globalAlpha = A;
        ctx.drawImage(face, x, y, w, h);
        let sp = S.sheen != null ? S.sheen : -1;
        if (sp < 0 && T >= TL.sheen && T < TL.sheen + 0.95) sp = (T - TL.sheen) / 0.95;
        if (sp >= 0 && sp <= 1) drawSheen(ctx, x, y, sp, A);
      }
    }
    ctx.restore();
  }

  return {
    measure,
    draw,
    get geo() {
      return g;
    }
  };
}
