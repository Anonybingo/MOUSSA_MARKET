// Gold dust for the home hero. A few thousand particles that start as a loose
// field of specks across the stage and then gather into a picture (see
// js/hero-picture.js): each particle is given a spot in the picture, with more
// of them where the picture is brighter, and flies there along a curved path.
// Once formed they shimmer, back away from the pointer, burst outward when the
// hero is tapped, and blow apart as the page is scrolled.
//
// Everything about the flight is a function of the timeline clock `T` (seconds)
// plus per-particle random numbers drawn from a seeded generator, so any moment
// of the intro can be reproduced exactly. Only the pointer physics — which
// starts once the picture is formed — keeps state between frames.
//
// Drawing is batched: particles are grouped by brightness (and by whether they
// sit below the headline, where the picture fades so the text stays readable),
// and each group is one path and one fill.

const NB = 8; // brightness buckets
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// seeded generator (mulberry32): the same dust every time
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick `n` spots on the picture, the chance of a spot proportional to its
// brightness. Returns [x, y, brightness] triples, x and y in 0…1.
export function samplePicture(canvas, n, random, gamma = 1.4) {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  const cdf = new Float64Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const L = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    lum[i] = L;
    if (L > 0.035) sum += Math.pow(L, gamma);
    cdf[i] = sum;
  }
  const out = new Float32Array(n * 3);
  if (sum === 0) return out;
  for (let k = 0; k < n; k++) {
    const r = random() * sum;
    let lo = 0;
    let hi = w * h - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    out[k * 3] = ((lo % w) + random()) / w;
    out[k * 3 + 1] = (Math.floor(lo / w) + random()) / h;
    out[k * 3 + 2] = lum[lo];
  }
  return out;
}

// bronze in the shadows to champagne in the highlights
function bucketColor(k) {
  const t = k / (NB - 1);
  const c = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${c(172, 255)},${c(120, 243)},${c(54, 210)})`;
}

export function createDust({ points, ambient = 0, seed = 11, timeline }) {
  const N = points.length / 3;
  const TOT = N + ambient;
  const random = seededRandom(seed);

  const TL = { dustIn: [3.9, 4.7], converge: 4.5, ...timeline };

  // per-particle randoms (fixed for life)
  const u0 = new Float32Array(TOT); // start position, 0…1 of the stage
  const v0 = new Float32Array(TOT);
  const tx = new Float32Array(N); // spot in the picture, 0…1
  const ty = new Float32Array(N);
  const delay = new Float32Array(N);
  const dur = new Float32Array(N);
  const swirl = new Float32Array(N);
  const size = new Float32Array(TOT);
  const phase = new Float32Array(TOT);
  const freq = new Float32Array(TOT);
  const ddx = new Float32Array(TOT); // direction it flies off in when scrolled away
  const ddy = new Float32Array(TOT);
  const damp = new Float32Array(TOT);
  const bucket = new Uint8Array(TOT);

  for (let i = 0; i < TOT; i++) {
    u0[i] = random();
    v0[i] = random();
    phase[i] = random() * TAU;
    freq[i] = 0.6 + random() * 1.1;
    const a = random() * TAU;
    ddx[i] = Math.cos(a);
    ddy[i] = Math.sin(a);
    damp[i] = 90 + random() * 260;
  }
  for (let i = 0; i < N; i++) {
    tx[i] = points[i * 3];
    ty[i] = points[i * 3 + 1];
    const b = points[i * 3 + 2];
    bucket[i] = Math.min(NB - 1, Math.floor(Math.pow(b, 0.85) * NB));
    size[i] = 0.95 + Math.pow(b, 0.8) * 1.35 + random() * 0.25;
    // the upper middle of the picture forms first, the edges and the hem last
    const d = Math.hypot((tx[i] - 0.5) * 0.75, ty[i] - 0.3);
    delay[i] = (d / 0.75) * 0.38 + random() * 0.14;
    dur[i] = 0.8 + random() * 0.5;
    swirl[i] = (random() - 0.5) * 0.5;
  }
  for (let i = N; i < TOT; i++) {
    bucket[i] = 0;
    size[i] = 0.8 + random() * 0.7;
  }

  // layout-dependent (pixels)
  const sx = new Float32Array(TOT);
  const sy = new Float32Array(TOT);
  const gx = new Float32Array(TOT);
  const gy = new Float32Array(TOT);
  const qx = new Float32Array(TOT); // sideways bow of the flight path
  const qy = new Float32Array(TOT);
  let groups = []; // [bucket * 2 + zone] and the ambient group at the end -> Uint32Array of indices
  let stageW = 1;
  let stageH = 1;

  // pointer physics state (formed particles only)
  const ox = new Float32Array(N);
  const oy = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  let agitated = false;
  let pendingKick = null;

  const colors = Array.from({ length: NB }, (_, k) => bucketColor(k));
  const bucketAlpha = Array.from({ length: NB }, (_, k) => 0.3 + 0.7 * Math.pow(k / (NB - 1), 0.9));

  // `box`: { w, h, pic: { x, y, w, h }, fadeY } in pixels — the stage, where the
  // picture goes, and the height below which the picture thins out
  function layout(box) {
    stageW = box.w;
    stageH = box.h;
    const lists = Array.from({ length: NB * 2 + 1 }, () => []);
    for (let i = 0; i < TOT; i++) {
      sx[i] = u0[i] * box.w;
      sy[i] = v0[i] * box.h;
      if (i < N) {
        gx[i] = box.pic.x + tx[i] * box.pic.w;
        gy[i] = box.pic.y + ty[i] * box.pic.h;
        const dx = gx[i] - sx[i];
        const dy = gy[i] - sy[i];
        qx[i] = -dy * swirl[i];
        qy[i] = dx * swirl[i];
        lists[bucket[i] * 2 + (gy[i] > box.fadeY ? 1 : 0)].push(i);
      } else {
        gx[i] = sx[i];
        gy[i] = sy[i];
        lists[NB * 2].push(i);
      }
    }
    groups = lists.map((l) => Uint32Array.from(l));
  }

  // S: { T, now, dt, scroll, parX, parY, pointer: { x, y, on }, quality }
  function render(ctx, S) {
    const { T, now } = S;
    const dustIn = smooth(TL.dustIn[0], TL.dustIn[1], T);
    if (dustIn <= 0) return;
    const form = smooth(TL.converge + 0.3, TL.converge + 1.6, T);
    const D = smooth(0.04, 0.9, S.scroll || 0);
    const fade = 1 - 0.94 * D;
    const q = S.quality || 1;
    const dt = clamp(S.dt || 1 / 60, 0.001, 1 / 20);
    const parX = S.parX || 0;
    const parY = S.parY || 0;

    // pointer physics only once the picture is mostly there
    const px = S.pointer ? S.pointer.x : -9999;
    const py = S.pointer ? S.pointer.y : -9999;
    const pointerOn = !!(S.pointer && S.pointer.on) && form > 0.7;
    const physics = form > 0.7 && (pointerOn || agitated || pendingKick);
    const R = Math.max(70, Math.min(150, stageW * 0.11));
    const R2 = R * R;
    let moving = false;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let g = 0; g < groups.length; g++) {
      const list = groups[g];
      const ambientGroup = g === NB * 2;
      const len = ambientGroup ? list.length : Math.ceil(list.length * q);
      if (!len) continue;

      const b = ambientGroup ? 0 : g >> 1;
      const zone = ambientGroup ? 0 : g & 1;
      let alpha;
      if (ambientGroup) alpha = 0.4 * dustIn;
      else {
        const dustAlpha = 0.34 + 0.12 * (b / (NB - 1));
        alpha = (dustAlpha + (bucketAlpha[b] - dustAlpha) * form) * dustIn * (zone ? 0.4 : 1);
      }
      alpha *= fade;
      if (alpha < 0.01) continue;

      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = ambientGroup ? 'rgb(214,172,96)' : colors[b];
      ctx.beginPath();

      for (let k = 0; k < len; k++) {
        const i = list[k];
        let x;
        let y;
        let s = size[i];

        if (ambientGroup) {
          // loose dust that never gathers: drifts about its own spot
          x = sx[i] + Math.sin(now * 0.00022 * freq[i] + phase[i]) * 14 + parX * 0.3;
          y = sy[i] + Math.cos(now * 0.00018 * freq[i] + phase[i] * 1.3) * 11 + parY * 0.3;
        } else {
          const e = clamp((T - TL.converge - delay[i]) / dur[i], 0, 1);
          const ee = e * e * (3 - 2 * e);
          const bow = Math.sin(Math.PI * ee);
          x = sx[i] + (gx[i] - sx[i]) * ee + qx[i] * bow;
          y = sy[i] + (gy[i] - sy[i]) * ee + qy[i] * bow;
          if (e < 1) {
            // still loose: a slow drift, fading out as it is drawn in
            x += Math.sin(now * 0.0004 * freq[i] + phase[i]) * 6 * (1 - ee);
            y += Math.cos(now * 0.00033 * freq[i] + phase[i]) * 5 * (1 - ee);
            s *= 0.6 + 0.4 * ee;
          } else {
            x += Math.sin(now * 0.0019 * freq[i] + phase[i]) * 0.6;
            y += Math.cos(now * 0.0016 * freq[i] + phase[i]) * 0.6;
          }
          const depth = 0.35 + 0.65 * ee;
          x += parX * depth;
          y += parY * depth;

          if (physics) {
            // spring back to rest, pushed away by the pointer and by a tap
            let ax = -ox[i] * 38 - vx[i] * 5.2;
            let ay = -oy[i] * 38 - vy[i] * 5.2;
            if (pendingKick) {
              const kx = x - pendingKick.x;
              const ky = y - pendingKick.y;
              const kd2 = kx * kx + ky * ky;
              const KR = pendingKick.r;
              if (kd2 < KR * KR) {
                const kd = Math.sqrt(kd2) || 1;
                const f = (1 - kd / KR) * pendingKick.strength * (0.5 + damp[i] / 400);
                vx[i] += (kx / kd) * f;
                vy[i] += (ky / kd) * f;
              }
            }
            if (pointerOn) {
              const dx = x + ox[i] - px;
              const dy = y + oy[i] - py;
              const d2 = dx * dx + dy * dy;
              if (d2 < R2) {
                const d = Math.sqrt(d2) || 1;
                const f = (1 - d / R) * (1 - d / R) * 3600;
                ax += (dx / d) * f;
                ay += (dy / d) * f;
              }
            }
            vx[i] += ax * dt;
            vy[i] += ay * dt;
            ox[i] += vx[i] * dt;
            oy[i] += vy[i] * dt;
            if (Math.abs(ox[i]) + Math.abs(oy[i]) + Math.abs(vx[i]) + Math.abs(vy[i]) > 0.4) moving = true;
          }
          x += ox[i];
          y += oy[i];
        }

        if (D > 0) {
          x += ddx[i] * D * damp[i];
          y += (ddy[i] - 0.55) * D * damp[i];
        }
        ctx.rect(x - s / 2, y - s / 2, s, s);
      }
      ctx.fill();
    }
    ctx.restore();

    if (physics) {
      agitated = moving;
      pendingKick = null;
    }
  }

  return {
    count: N,
    layout,
    render,
    // true while particles are still springing back from a push: the caller keeps drawing at full rate
    get busy() {
      return agitated || !!pendingKick;
    },
    // a tap: everything near (x, y) is thrown outward and then settles back
    kick(x, y) {
      pendingKick = { x, y, r: Math.max(150, Math.min(300, stageW * 0.22)), strength: 520 };
      agitated = true;
    }
  };
}
