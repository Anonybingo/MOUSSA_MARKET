// Home-page ribbons: two bands of big type crossing in an X between the hero and
// the first section. The CSS does the sliding (a transform animation on each
// band's .mq-track) and all of the look; this file builds what that needs and
// adds the extras:
//
//   - the seamless loops. The HTML holds ONE set of phrases per band. A loop needs
//     two identical groups, each at least as wide as the band (the track slides by
//     exactly one group's width, then starts over), so a set is repeated until it
//     spans the band and then cloned once. They are rebuilt on resize, on a
//     language switch (the text widths change) and when the web font lands.
//     Clones are aria-hidden: screen readers get the HTML's own set once.
//   - a constant speed in px/second per band, whatever the width (--mq-dur)
//   - scroll velocity: scrolling down speeds both bands up, scrolling up turns
//     them around, and they ease back to their own pace when you stop. The same
//     velocity leans the lettering (--mq-skew)
//   - scroll position: --mq-p (0 -> 1 as the section travels up the screen) slides
//     the two bands past each other, so the point where they cross travels sideways
//   - the entrance: the bands wait outside the screen (.is-ready without .is-in)
//     and slide in the first time the section comes into view
//   - pausing: on hover, while off screen, on a tap, and from a button that only
//     keyboard users ever see (moving text needs a way to stop it — WCAG 2.2.2)
//   - prefers-reduced-motion: none of it. The section never becomes .is-ready and
//     the CSS shows the same X as a still picture instead.

import { t } from './i18n.js';

const SPEED = 58; // px per second, for a band without its own data-speed

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
  const stage = marquee.querySelector('.mq-stage');
  const lanes = [...marquee.querySelectorAll('.mq-ribbon')]
    .map((el) => {
      const track = el.querySelector('.mq-track');
      const source = track && track.querySelector('.mq-group');
      return track && source ? { el, track, source, speed: Number(el.dataset.speed) || SPEED } : null;
    })
    .filter(Boolean);
  if (!stage || !lanes.length) return;

  let built = false;
  let onScreen = true;
  let builtFor = 0; // stage width the loops were built for

  const animations = () =>
    lanes.flatMap((l) => l.track.getAnimations().filter((a) => a.animationName === 'mq-scroll'));

  /* ---- the loops --------------------------------------------------------- */

  function build() {
    // back to just the HTML's own sets
    for (const l of lanes) {
      l.track.querySelectorAll('.mq-group').forEach((g) => {
        if (g !== l.source) g.remove();
      });
      l.source.querySelectorAll('.mq-clone').forEach((n) => n.remove());
    }
    marquee.classList.remove('is-ready');
    built = false;
    if (reduced.matches) return;

    // measure in the animated layout (one unwrapped line), so switch it on first.
    // offsetWidth, not getBoundingClientRect: the bands are tilted, and a tilted
    // box reports the width of its bounding rectangle
    marquee.classList.add('is-ready');
    const widths = lanes.map((l) => l.source.offsetWidth);
    if (widths.some((w) => !w)) {
      marquee.classList.remove('is-ready');
      return;
    }

    builtFor = stage.clientWidth;
    lanes.forEach((l, i) => {
      const copies = Math.max(1, Math.ceil(l.el.offsetWidth / widths[i]));
      const items = [...l.source.children];
      for (let c = 1; c < copies; c++) {
        for (const li of items) {
          const clone = li.cloneNode(true);
          clone.classList.add('mq-clone');
          clone.setAttribute('aria-hidden', 'true');
          l.source.appendChild(clone);
        }
      }

      const twin = l.source.cloneNode(true); // the loop's other half
      twin.setAttribute('aria-hidden', 'true');
      l.track.appendChild(twin);

      l.el.style.setProperty('--mq-dur', `${(l.source.offsetWidth / l.speed).toFixed(1)}s`);
    });
    built = true;

    // start far into the animation: a negative playback rate (scrolling up)
    // needs time left to run backwards, and a loop looks the same anywhere
    for (const a of animations()) a.currentTime = 1e8;
  }

  /* ---- scroll: velocity, lean and position ------------------------------- */

  let lastY = window.scrollY;
  let vel = 0; // smoothed scroll speed, px per frame
  let rate = 1; // the playback rate applied so far
  let lean = 0; // the lettering's lean, degrees
  let raf = 0;

  function setProgress() {
    if (reduced.matches) {
      marquee.style.removeProperty('--mq-p'); // the still X stays where the CSS puts it
      return;
    }
    const r = stage.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
    marquee.style.setProperty('--mq-p', p.toFixed(3));
  }

  function frame() {
    raf = 0;
    const y = window.scrollY;
    vel += (y - lastY - vel) * 0.18;
    lastY = y;

    rate += (1 + clamp(vel * 0.16, -4, 5) - rate) * 0.12;
    lean += (clamp(vel * 0.5, -9, 9) - lean) * 0.16;
    for (const a of animations()) a.playbackRate = rate;
    marquee.style.setProperty('--mq-skew', `${lean.toFixed(2)}deg`);
    setProgress();

    if (Math.abs(vel) > 0.05 || Math.abs(rate - 1) > 0.01 || Math.abs(lean) > 0.05) {
      raf = requestAnimationFrame(frame);
    } else {
      rate = 1;
      lean = 0;
      for (const a of animations()) a.playbackRate = 1;
      marquee.style.setProperty('--mq-skew', '0deg');
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
  // touch screens have no hover to pause on: tapping the bands does it
  marquee.addEventListener('click', () => {
    if (touchOnly.matches) setPaused(!paused);
  });

  /* ---- in and out of view ------------------------------------------------ */

  // The entrance plays once, when a good part of the section is showing. While the
  // page is still loading the layout is not final (the header and the hero are
  // still taking their size, so the section sits higher than it will), and the
  // loader covers the screen anyway: wait for it to go before believing what the
  // observer says. A timer covers a page whose loader never shows.
  let settled = false;
  function checkIn() {
    if (!settled || marquee.classList.contains('is-in')) return;
    const r = marquee.getBoundingClientRect();
    const shown = clamp(Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0), 0, r.height);
    if (r.height && shown / r.height >= 0.25) marquee.classList.add('is-in');
  }
  const settle = () => {
    settled = true;
    checkIn();
  };
  document.addEventListener('loader-hidden', settle);
  window.addEventListener('load', () => setTimeout(settle, 6000));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        onScreen = entry.isIntersecting;
        marquee.classList.toggle('is-offscreen', !onScreen);
        if (onScreen) {
          setProgress();
          lastY = window.scrollY;
        }
        checkIn();
      },
      { threshold: [0, 0.25] }
    ).observe(marquee);
  } else {
    marquee.classList.add('is-in');
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
      if (Math.abs(stage.clientWidth - builtFor) > 1) build();
      setProgress();
    });
  });
  reduced.addEventListener('change', () => {
    build();
    setProgress();
  });

  updateButton();
  setProgress();
  build();
}

if (marquee) {
  try {
    init();
  } catch (err) {
    // never leave a half-built loop behind: fall back to the still bands
    console.error('marquee:', err);
    marquee.classList.remove('is-ready');
  }
}
