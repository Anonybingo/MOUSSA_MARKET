// Home-page marquee strip. The CSS does the scrolling (a transform animation on
// .marquee-track) and the look; this file builds what that needs and adds the
// small extras:
//
//   - the seamless loop. The HTML holds ONE set of items. The loop needs two
//     identical groups, each at least as wide as the screen (the track slides
//     by exactly one group's width, then starts over), so the set is repeated
//     until it spans the viewport and then cloned once. It is rebuilt on resize,
//     on a language switch (the text widths change) and when the web font lands.
//     Clones are aria-hidden: screen readers get the HTML's own set once.
//   - a constant speed in px/second, whatever the width (--mq-dur)
//   - scroll velocity: scrolling down speeds the strip up, scrolling up turns it
//     around, and it eases back to its own pace when you stop
//   - pausing: on hover, while off screen, on a tap, and from a button that only
//     keyboard users ever see (moving text needs a way to stop it — WCAG 2.2.2)
//   - prefers-reduced-motion: none of it. The strip never becomes .is-ready and
//     the CSS shows a still line instead.

import { t } from './i18n.js';

const SPEED = 55; // px per second at the strip's own pace

const marquee = document.querySelector('.marquee');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const touchOnly = window.matchMedia('(hover: none)');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// t() hands back the key itself while the strings are still loading
function label(key, fallback) {
  const text = t(key);
  return text === key ? fallback : text;
}

function init() {
  const viewport = marquee.querySelector('.marquee-viewport');
  const track = marquee.querySelector('.marquee-track');
  const source = track && track.querySelector('.marquee-group');
  if (!viewport || !track || !source) return;

  let built = false;
  let onScreen = true;
  let builtFor = 0; // viewport width the loop was built for

  const animation = () => track.getAnimations().find((a) => a.animationName === 'mq-scroll');

  /* ---- the loop ---------------------------------------------------------- */

  function build() {
    // back to just the HTML's own set
    track.querySelectorAll('.marquee-group').forEach((g) => {
      if (g !== source) g.remove();
    });
    source.querySelectorAll('.mq-clone').forEach((n) => n.remove());
    marquee.classList.remove('is-ready');
    built = false;
    if (reduced.matches) return;

    // measure in the animated layout (one unwrapped line), so switch it on first
    marquee.classList.add('is-ready');
    const setWidth = source.getBoundingClientRect().width;
    if (!setWidth) {
      marquee.classList.remove('is-ready');
      return;
    }

    builtFor = viewport.clientWidth;
    const copies = Math.max(1, Math.ceil(builtFor / setWidth));
    const items = [...source.children];
    for (let c = 1; c < copies; c++) {
      for (const li of items) {
        const clone = li.cloneNode(true);
        clone.classList.add('mq-clone');
        clone.setAttribute('aria-hidden', 'true');
        source.appendChild(clone);
      }
    }

    const twin = source.cloneNode(true); // the loop's other half
    twin.setAttribute('aria-hidden', 'true');
    track.appendChild(twin);

    marquee.style.setProperty('--mq-dur', `${(source.getBoundingClientRect().width / SPEED).toFixed(1)}s`);
    built = true;

    // start far into the animation: a negative playback rate (scrolling up)
    // needs time left to run backwards, and the loop looks the same anywhere
    const a = animation();
    if (a) a.currentTime = 1e8;
  }

  /* ---- scroll velocity --------------------------------------------------- */

  let lastY = window.scrollY;
  let vel = 0; // smoothed scroll speed, px per frame
  let rate = 1; // the playback rate applied so far
  let raf = 0;

  function frame() {
    raf = 0;
    const y = window.scrollY;
    vel += (y - lastY - vel) * 0.18;
    lastY = y;

    rate += (1 + clamp(vel * 0.16, -4, 5) - rate) * 0.12;
    const a = animation();
    if (a) a.playbackRate = rate;

    if (Math.abs(vel) > 0.05 || Math.abs(rate - 1) > 0.01) {
      raf = requestAnimationFrame(frame);
    } else {
      rate = 1;
      if (a) a.playbackRate = 1;
    }
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!raf && built && onScreen && !reduced.matches) raf = requestAnimationFrame(frame);
    },
    { passive: true }
  );

  /* ---- pausing ----------------------------------------------------------- */

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'marquee-toggle';
  marquee.appendChild(button);

  let paused = false;
  function updateButton() {
    button.textContent = paused
      ? label('marquee_play', 'Resume scrolling text')
      : label('marquee_pause', 'Pause scrolling text');
  }
  function setPaused(value) {
    paused = value;
    marquee.classList.toggle('is-paused', paused);
    updateButton();
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    setPaused(!paused);
  });
  // touch screens have no hover to pause on: tapping the strip does it
  marquee.addEventListener('click', () => {
    if (touchOnly.matches) setPaused(!paused);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        marquee.classList.toggle('is-offscreen', !onScreen);
      },
      { threshold: 0 }
    ).observe(marquee);
  }

  /* ---- keep it right ----------------------------------------------------- */

  document.addEventListener('translations-ready', () => {
    updateButton();
    build();
  });
  if (document.fonts) document.fonts.ready.then(build);

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (Math.abs(viewport.clientWidth - builtFor) > 1) build();
    });
  });
  reduced.addEventListener('change', build);

  updateButton();
  build();
}

if (marquee) {
  try {
    init();
  } catch (err) {
    // never leave a half-built loop behind: fall back to the still strip
    console.error('marquee:', err);
    marquee.classList.remove('is-ready');
  }
}
