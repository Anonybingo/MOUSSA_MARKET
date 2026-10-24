// Product-card hover: the card leans away from the pointer (a small 3D tilt),
// a soft glare follows the pointer across it, and its shadow swings the
// opposite way. The visuals live in the "Product grid + cards" block of
// css/style.css; this file only reports where the pointer is, as CSS variables:
//   --rx / --ry   tilt, in degrees
//   --tx / --ty   pointer position, -1 … 1 from the card's centre
//   --mx / --my   pointer position in %, for the glare
//   --gy          pointer height in % of the photo (not the whole card), for the photo's highlight
//
// One delegated listener covers the whole page, so cards that are rendered
// later (search, filters, a language switch) need no setup. Mouse and pen only:
// touch devices, and anyone who prefers reduced motion, never get the tilt.

const MAX_TILT = 7; // degrees, at the very edge of the card

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let card = null; // the card the pointer is on
let box = null; // its position and size, read when the pointer arrived (while still flat)
let photoBox = null; // the same for the card's photo
let pending = null; // latest pointer position, applied once per frame
let frame = 0;

function release() {
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  pending = null;
  if (!card) return;
  card.classList.remove('is-tilting');
  for (const name of ['--rx', '--ry', '--tx', '--ty', '--mx', '--my', '--gy']) card.style.removeProperty(name);
  card = null;
  box = null;
  photoBox = null;
}

function paint() {
  frame = 0;
  if (!card || !box || !pending) return;

  const px = clamp((pending.x - box.left) / box.width, 0, 1);
  const py = clamp((pending.y - box.top) / box.height, 0, 1);
  const tx = (px - 0.5) * 2; // -1 at the left edge, 1 at the right
  const ty = (py - 0.5) * 2; // -1 at the top, 1 at the bottom

  // the edge nearest the pointer is the one that dips away
  card.style.setProperty('--ry', `${(tx * MAX_TILT).toFixed(2)}deg`);
  card.style.setProperty('--rx', `${(-ty * MAX_TILT).toFixed(2)}deg`);
  card.style.setProperty('--tx', tx.toFixed(3));
  card.style.setProperty('--ty', ty.toFixed(3));
  card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
  card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
  if (photoBox) {
    // not clamped: below the photo the glow's centre sits outside it and only its edge reaches in
    const gy = (pending.y - photoBox.top) / Math.max(photoBox.height, 1);
    card.style.setProperty('--gy', `${(clamp(gy, -0.5, 1.5) * 100).toFixed(1)}%`);
  }
}

document.addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType === 'touch' || reducedMotion.matches || !finePointer.matches) {
      release();
      return;
    }

    const target = e.target instanceof Element ? e.target.closest('.product-card') : null;
    if (target !== card) {
      release();
      if (!target) return;
      card = target;
      box = target.getBoundingClientRect();
      const photo = target.querySelector('.thumb');
      photoBox = photo ? photo.getBoundingClientRect() : null;
      card.classList.add('is-tilting');
    }

    pending = { x: e.clientX, y: e.clientY };
    if (!frame) frame = requestAnimationFrame(paint);
  },
  { passive: true }
);

// None of these send a pointermove, but each one means "stop tilting": the
// pointer leaving the window, the tab losing focus, the page scrolling under a
// pointer that isn't moving (the next real move picks the card up again).
document.documentElement.addEventListener('pointerleave', release);
window.addEventListener('blur', release);
window.addEventListener('scroll', release, { passive: true });
