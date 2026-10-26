// The home hero. It is a dark stage with a canvas behind the copy; this file
// is the conductor. The drawing itself lives in three modules:
//
//   hero-intro.js    the intro (dot, "!", letters, HAKI > BOUTIQUE), the big
//                    word BOUTIQUE and its sheen
//   hero-dust.js     the gold dust that gathers into the picture, and what it
//                    does when you move the pointer, tap, or scroll
//   hero-picture.js  the picture: a shirt on a gold hanger (or your own image)
//
// What happens here:
//   * one clock. The intro is a pure function of a time T, and T is the
//     currentTime of a Web Animations animation (see startClock). That keeps
//     the canvas in step with the CSS reveals of the copy — they are on the same
//     timeline — and means anything that scrubs document.getAnimations() (the
//     browser's animation inspector, our tests) scrubs the canvas too.
//   * when to start: only once the headline text is final (translations), the
//     web font is in (the canvas draws with it) and the loading overlay is gone
//     — and a beat after it has finished fading out, so the first thing you see
//     of the intro is its very first frame. The whole intro plays on every
//     load, reloads included.
//   * the intro's clock only runs while it can be seen: it waits while the
//     loading overlay is up (a language switch brings it back for a moment),
//     while the tab is hidden and while the hero is scrolled out of view
//   * the loop: requestAnimationFrame, only while the hero is on screen, at a
//     lower rate once the intro has finished, and it thins the dust out if
//     frames take too long
//   * skip: a click or tap on the stage, or a key press, jumps to the end
//   * the tagline: first half of the words bold, second half italic gold
//
// Progressive enhancement. An inline script in index.html's <head> sets
// html.hero-fx-armed only when motion is allowed. With JS off, or if anything
// here fails, the hero is the static block: the gold word BOUTIQUE is plain
// text in the page and the copy is simply there. With prefers-reduced-motion
// the canvas draws the finished picture once and nothing ever moves.

import { makePictureCanvas, drawImageFitted } from './hero-picture.js';
import { createDust, samplePicture, seededRandom } from './hero-dust.js';
import { createIntro, TL } from './hero-intro.js';

const root = document.documentElement;
const hero = document.querySelector('.hero');
const stage = hero && hero.querySelector('.hero-stage');
const wordEl = stage && stage.querySelector('.hero-word');
const probe = wordEl && wordEl.querySelector('.hero-probe');
const row = stage && stage.querySelector('.hero-row');
const armed = root.classList.contains('hero-fx-armed');
const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// The loading overlay (css/style.css .loader-overlay) fades out in 250 ms. The
// intro starts once that is over, plus a beat of calm, empty stage.
const LOADER_FADE_MS = 300;
const BEAT_MS = 150;

/* ==========================================================================
   the tagline: "Style that speaks for you" -> **Style that** *speaks for you*
   The translations rewrite the text with textContent, so this is redone after
   every language load.
   ========================================================================== */

function styleTagline() {
  const el = hero.querySelector('.hero-tag');
  if (!el) return;
  const words = el.textContent.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length < 2 || !words[0]) return;
  const cut = Math.floor(words.length / 2);
  const bold = document.createElement('b');
  bold.textContent = words.slice(0, cut).join(' ');
  const ital = document.createElement('i');
  ital.textContent = words.slice(cut).join(' ');
  el.textContent = '';
  el.append(bold, ' ', ital);
}

/* ==========================================================================
   the canvas
   ========================================================================== */

function createStage() {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return null;
  }

  const intro = createIntro();
  const N = coarse ? 6000 : 12000; // dust particles that make the picture
  const AMBIENT = coarse ? 220 : 450; // loose dust that never gathers
  let dust = null;

  const S = {
    W: 0,
    H: 0,
    dpr: 1,
    measured: false,
    clock: null,
    visible: true,
    raf: 0,
    timer: 0,
    static: false,
    lastDraw: 0,
    quality: 1,
    cost: 4, // moving average of ms per frame (JS side)
    scroll: 0,
    pointer: { x: -9999, y: -9999, on: false },
    tx: 0,
    ty: 0,
    parX: 0,
    parY: 0,
    kicked: false,
    broken: false
  };

  // Why the clock is stopped, if it is: 'loader' (the overlay is up), 'hidden'
  // (another tab is in front), 'offscreen' (the hero is scrolled out of view).
  const holds = new Set();

  function buildDust(source) {
    const points = samplePicture(source, N, seededRandom(5));
    dust = createDust({ points, ambient: AMBIENT, seed: 11, timeline: { dustIn: TL.dustIn, converge: TL.converge } });
    if (S.measured) layoutDust();
  }

  // where the picture goes: centred, nearly the stage's height, its top just
  // under the stage's edge; it thins out below the word so the copy stays legible
  let geo = null;
  function layoutDust() {
    if (!dust || !geo) return;
    const picH = Math.min(S.H * 0.9, S.W * 1.2);
    const picW = picH * 0.75;
    dust.layout({
      w: S.W,
      h: S.H,
      pic: { x: geo.cx - picW / 2, y: S.H * 0.045, w: picW, h: picH },
      fadeY: geo.baseY + 0.08 * geo.F
    });
  }

  buildDust(makePictureCanvas());

  // your own picture instead: <section class="hero" data-hero-image="/assets/me.png">
  const own = hero.dataset.heroImage;
  if (own) {
    const img = new Image();
    img.onload = () => {
      try {
        buildDust(drawImageFitted(document.createElement('canvas'), img));
      } catch {
        /* a cross-origin image can't be read: keep the shirt */
      }
    };
    img.src = own;
  }

  // read the layout: stage size, and where the DOM's placeholder word sits —
  // the canvas draws the big word exactly there
  function measure() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H || !wordEl || !probe) return false;
    S.W = W;
    S.H = H;
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * S.dpr);
    canvas.height = Math.round(H * S.dpr);
    const sr = stage.getBoundingClientRect();
    const wr = wordEl.getBoundingClientRect();
    const pr = probe.getBoundingClientRect();
    const F = parseFloat(getComputedStyle(wordEl).fontSize) || 100;
    geo = { F, cx: wr.left - sr.left + wr.width / 2, baseY: pr.bottom - sr.top };
    intro.measure({ W, H, F, cx: geo.cx, baseY: geo.baseY, dpr: S.dpr });
    layoutDust();
    S.measured = true;
    return true;
  }

  function currentT() {
    if (S.clock) {
      const ct = S.clock.currentTime;
      return ct == null ? TL.end : clamp(Number(ct) / 1000, 0, TL.end);
    }
    return S.fixedT == null ? -1 : S.fixedT; // -1: not started, nothing to draw
  }

  function updateScroll() {
    const p = clamp(window.scrollY / (S.H * 0.85 || 1), 0, 1);
    if (p === S.scroll) return;
    S.scroll = p;
    if (row) {
      row.style.opacity = p > 0 ? String(Math.max(0, 1 - p * 1.15).toFixed(3)) : '';
      row.style.transform = p > 0 ? `translate3d(0, ${(p * 40).toFixed(1)}px, 0)` : '';
    }
  }

  /* ---- one frame ---- */
  function draw(now, T) {
    const dt = clamp((now - S.lastDraw) / 1000 || 0.016, 0.001, 0.05);
    S.lastDraw = now;

    // pointer parallax (a slow drift instead on touch screens)
    if (coarse) {
      S.tx = Math.sin(now / 4300) * 0.8;
      S.ty = Math.cos(now / 5700) * 0.7;
    }
    S.parX += (S.tx * 14 - S.parX) * 0.08;
    S.parY += (S.ty * 9 - S.parY) * 0.08;

    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.W, S.H);
    if (T < 0) return;

    const p = S.scroll;
    dust.render(ctx, {
      T,
      now,
      dt,
      scroll: p,
      parX: S.parX,
      parY: S.parY,
      pointer: S.pointer,
      quality: S.quality
    });

    // a sheen over the word every ten seconds once the intro is over
    let sheen;
    if (T >= TL.end) {
      const ph = (now / 1000 + 3) % 10;
      if (ph < 1) sheen = ph;
    }
    intro.draw(ctx, T, { fade: 1 - clamp(p * 1.15, 0, 1), lift: p * 40, sheen });
  }

  // Once the intro is over nothing needs 60 fps: the dust only shimmers and
  // drifts. The loop then runs at ~25 fps on a timer, and goes back to the
  // display's rate the moment the pointer, a tap, a scroll or a spring-back
  // needs it.
  const IDLE_MS = 40;

  function frame(now) {
    S.raf = 0;
    if (!S.visible || !S.measured || S.broken || S.static) return;
    const T = currentT();
    if (T < 0) return; // the intro has not started: start() wakes the loop
    try {
      const t0 = performance.now();
      draw(now, T);
      const ms = performance.now() - t0;
      S.cost = S.cost * 0.9 + ms * 0.1;
      // thin the dust out if drawing is slow, bring it back if there is room
      if (S.cost > 14 && S.quality > 0.4) S.quality = Math.max(0.4, S.quality - 0.05);
      else if (S.cost < 6 && S.quality < 1) S.quality = Math.min(1, S.quality + 0.01);
    } catch (err) {
      console.error('hero-fx:', err);
      S.broken = true;
      fail();
      return;
    }
    // (on touch screens the picture only drifts slowly by itself: that needs no
    // more than the idle rate)
    const busy =
      S.pointer.on ||
      S.kicked ||
      dust.busy ||
      (!coarse && (Math.abs(S.tx * 14 - S.parX) > 0.05 || Math.abs(S.ty * 9 - S.parY) > 0.05));
    S.kicked = false;
    // idle, or the clock is held: no need for the display's full rate
    if ((T >= TL.end && !busy) || holds.size) later(IDLE_MS);
    else wake();
  }

  // something happened: (re)start the loop at full rate
  function wake() {
    if (S.static || S.broken || !S.visible || !S.measured) return;
    if (S.timer) {
      clearTimeout(S.timer);
      S.timer = 0;
    }
    if (!S.raf) S.raf = requestAnimationFrame(frame);
  }

  function later(ms) {
    if (S.raf || S.timer || S.static || S.broken) return;
    S.timer = setTimeout(() => {
      S.timer = 0;
      if (!S.raf && S.visible && S.measured && !S.broken && !S.static) S.raf = requestAnimationFrame(frame);
    }, ms);
  }

  // the canvas failed at run time: drop it and leave the plain page
  function fail() {
    canvas.remove();
    root.classList.remove('hero-canvas-on');
    root.classList.add('hero-no-canvas');
    if (row) {
      row.style.opacity = '';
      row.style.transform = '';
    }
    finishCss();
  }

  /* ---- the clock ---- */
  function startClock() {
    // a do-nothing animation whose only job is to count time; the property
    // is one nothing else uses
    S.clock = canvas.animate([{ outlineOffset: '0px' }, { outlineOffset: '0px' }], {
      duration: TL.end * 1000,
      fill: 'forwards'
    });
  }

  function heroAnimations() {
    return hero.getAnimations ? hero.getAnimations({ subtree: true }).filter((a) => a !== S.clock) : [];
  }

  function finishCss() {
    for (const a of heroAnimations()) {
      try {
        a.finish();
      } catch {
        /* an animation that can't finish (infinite) isn't one of ours */
      }
    }
  }

  // Stop or resume the intro — the canvas clock and the CSS reveals together,
  // so they can never drift apart.
  function applyHold() {
    if (!S.clock) return;
    const held = holds.size > 0;
    for (const a of [S.clock, ...heroAnimations()]) {
      try {
        if (held && a.playState === 'running') a.pause();
        else if (!held && a.playState === 'paused') a.play();
      } catch {
        /* already finished */
      }
    }
    wake();
  }

  function hold(reason, on) {
    const before = holds.size > 0;
    if (on) holds.add(reason);
    else holds.delete(reason);
    if (before !== holds.size > 0) applyHold();
  }

  function skip() {
    if (!S.clock || currentT() >= TL.end) return;
    try {
      S.clock.finish();
    } catch {
      /* already over */
    }
    finishCss();
    wake();
  }

  function start() {
    startClock();
    root.classList.add('hero-fx-play'); // the CSS reveals begin with this class
    if (document.hidden) holds.add('hidden');
    applyHold(); // begins held if the tab is hidden, the hero is off screen or the overlay is up
    wake();
  }

  /* ---- input ---- */
  function bindInput() {
    const local = (e) => {
      const r = stage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top, r];
    };
    stage.addEventListener(
      'pointermove',
      (e) => {
        const [x, y, r] = local(e);
        S.pointer.x = x;
        S.pointer.y = y;
        S.pointer.on = e.pointerType === 'mouse' || e.pointerType === 'pen';
        if (!coarse) {
          S.tx = (x / r.width - 0.5) * 2;
          S.ty = (y / r.height - 0.5) * 2;
        }
        wake();
      },
      { passive: true }
    );
    stage.addEventListener('pointerleave', () => {
      S.pointer.on = false;
      S.tx = 0;
      S.ty = 0;
      wake();
    });
    // a tap or click: skips the intro while it plays, then throws the dust about
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest && e.target.closest('a, button, input, select, textarea, label, form')) return;
      if (currentT() < TL.end) {
        skip();
        return;
      }
      const [x, y] = local(e);
      dust.kick(x, y);
      S.kicked = true;
      wake();
    });
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab' || e.key === 'Shift') return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select')) return;
      skip();
    });
    // (scrolling doesn't skip the intro: it simply waits while the hero is out of view)
    window.addEventListener(
      'scroll',
      () => {
        updateScroll();
        wake();
      },
      { passive: true }
    );
  }

  /* ---- watching the layout ---- */
  function watch() {
    let queued = 0;
    const schedule = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        if (measure()) {
          updateScroll();
          if (S.clock || S.fixedT != null) draw(performance.now(), currentT());
          wake();
        }
      });
    };
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(schedule);
      ro.observe(stage);
      const lockup = stage.querySelector('.hero-lockup');
      if (lockup) ro.observe(lockup);
    } else {
      window.addEventListener('resize', schedule);
    }
    document.addEventListener('translations-ready', schedule);
    if (document.fonts) {
      document.fonts.ready.then(schedule);
      document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', schedule);
    }

    // not on screen: no loop, and the clock waits too (a page that reloads
    // scrolled down, or a visitor who scrolls away mid-intro, gets the rest of
    // the intro when the hero comes back) — likewise while the tab is hidden
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          S.visible = entry.isIntersecting;
          hold('offscreen', !S.visible);
          if (S.visible) wake();
        },
        { threshold: 0 }
      ).observe(stage);
    }
    document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));
  }

  return {
    S,
    measure,
    draw,
    wake,
    start,
    hold,
    skip,
    bindInput,
    watch,
    updateScroll,
    // reduced motion / instant: the finished picture, no clock, no loop
    freeze() {
      S.static = true; // no loop: redrawn only when the layout changes
      S.fixedT = TL.end;
      if (measure()) draw(0, TL.end);
    },
    destroy() {
      S.broken = true;
      canvas.remove();
    }
  };
}

/* ==========================================================================
   when to start
   ========================================================================== */

function init() {
  if (!hero || !stage || !wordEl) return;
  window.__heroFx = true; // tells the inline fallback in index.html that this script is alive
  styleTagline();
  document.addEventListener('translations-ready', styleTagline);

  let fx = null;
  try {
    fx = createStage();
  } catch (err) {
    console.error('hero-fx:', err);
  }
  if (!fx) {
    // no canvas: the page is the static block; if the intro had parked it, let it go
    root.classList.add('hero-no-canvas');
    root.classList.add('hero-fx-play');
    return;
  }

  const fontsReady =
    document.fonts && document.fonts.load
      ? Promise.race([
          Promise.all([document.fonts.load('800 100px Poppins'), document.fonts.ready]),
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]).catch(() => {})
      : Promise.resolve();

  // The inline script released the hero already (it timed out waiting for this
  // module), or motion is off: show the finished picture, nothing animated.
  const instant = !armed || root.classList.contains('hero-fx-play');
  if (instant) {
    fontsReady.then(() => {
      root.classList.add('hero-canvas-on');
      fx.freeze();
      fx.watch();
      if (armed) {
        // reveals that were already running: let them finish
        hero.getAnimations && hero.getAnimations({ subtree: true }).forEach((a) => {
          try {
            a.finish();
          } catch {
            /* not finishable */
          }
        });
      }
    });
    return;
  }

  const gates = { translations: false, fonts: false, loader: false };
  const loaderUp = () => !!document.querySelector('.loader-overlay.show');
  let played = false;
  let settle = 0; // timer: the overlay was hidden, wait out its fade and the beat
  let settling = false;

  const play = () => {
    if (played) return;
    played = true;
    root.classList.add('hero-canvas-on');
    fx.measure();
    fx.start();
    // (the safety net below can get here while the overlay is up: the clock waits for it)
    if (loaderUp()) fx.hold('loader', true);
  };
  const maybePlay = () => {
    if (gates.translations && gates.fonts && gates.loader) play();
  };

  fx.bindInput();
  fx.watch();
  fx.updateScroll();

  document.addEventListener('translations-ready', () => {
    gates.translations = true;
    maybePlay();
  });

  // The loading overlay (js/loader.js): the intro never runs behind it. It
  // starts a beat after the overlay has finished fading out. If the overlay
  // comes back while the intro plays (switching language reloads the page's
  // content), the clock waits for it again.
  document.addEventListener('loader-shown', () => {
    clearTimeout(settle);
    settling = false;
    gates.loader = false;
    fx.hold('loader', true);
  });
  document.addEventListener('loader-hidden', () => {
    clearTimeout(settle);
    settling = true;
    // wait out what is left of the fade (a blink of the overlay, as when the
    // language is switched, has hardly any), and — before the intro has begun —
    // a beat of calm
    const o = document.querySelector('.loader-overlay');
    const up = o ? parseFloat(getComputedStyle(o).opacity) || 0 : 0; // 1: fully up
    const wait = Math.ceil(up * LOADER_FADE_MS) + (played ? 0 : BEAT_MS);
    settle = setTimeout(() => {
      settling = false;
      if (loaderUp()) return; // shown again in the meantime: its own loader-hidden follows
      gates.loader = true;
      fx.hold('loader', false);
      maybePlay();
    }, wait);
  });

  fontsReady.then(() => {
    gates.fonts = true;
    maybePlay();
  });

  // Safety net if something upstream never reports in (offline, an error in the
  // page script): go anyway — but not while the overlay is up or still fading
  // (the page is then still loading and will report in).
  const fallback = () => {
    if (played) return;
    if (loaderUp() || settling) {
      setTimeout(fallback, 250);
      return;
    }
    play();
  };
  setTimeout(fallback, 4000);
}

try {
  init();
} catch (err) {
  // never leave the hero parked because of a bug here
  console.error('hero-fx:', err);
  root.classList.add('hero-no-canvas');
  root.classList.remove('hero-canvas-on');
  root.classList.add('hero-fx-play');
}
