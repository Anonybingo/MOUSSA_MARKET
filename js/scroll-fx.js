// Small scroll effects that every page shares. (The big pinned scene on the home
// page, js/edit-scene.js, is separate.)
//
//   - a thin gold line along the top of the window that fills as you read down
//     the page
//   - section headings that rise into place, word by word (.section-head h2 and
//     anything marked data-rise)
//   - the one IntersectionObserver behind every .reveal on the page (product cards,
//     the footer's columns, the "View all" link ...): activateReveal()
//
// Nothing here plays behind the page loader. While the overlay is up, whatever is
// on screen waits; a moment after it has gone every observer looks again and the
// reveals run where the visitor can see them.
//
// Under prefers-reduced-motion the headings are left alone and the CSS shows every
// .reveal at once; only the progress line stays, because it is an indicator rather
// than a movement (it follows the scroll, nothing eases).

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---- observers that wait for the loader ---------------------------------------- */

const covered = () => !!document.querySelector('.loader-overlay.show');
const observers = new Set();

// An IntersectionObserver that reports "now visible" only while the page loader is
// away. It remembers its targets so they can be looked at again afterwards.
function watcher(threshold, onChange) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (!el.isConnected) {
          // a re-rendered grid replaced it: stop watching instead of watching forever
          io.unobserve(el);
          io.targets.delete(el);
          return;
        }
        if (entry.isIntersecting && covered()) return;
        onChange(el, entry.isIntersecting);
      });
    },
    { threshold }
  );
  io.targets = new Set();
  io.watch = (el) => {
    io.targets.add(el);
    io.observe(el);
  };
  observers.add(io);
  return io;
}

// the overlay fades out over 0.25 s: look again just after that
document.addEventListener('loader-hidden', () => {
  setTimeout(() => {
    if (covered()) return;
    observers.forEach((io) => {
      [...io.targets].forEach((el) => {
        if (!el.isConnected) {
          io.targets.delete(el);
          return;
        }
        io.unobserve(el); // observing again gives a fresh first report
        io.observe(el);
      });
    });
  }, 300);
});

/* ---- reveal (cards, footer, links) ---------------------------------------------- */

let revealObserver = null;

// Fades + slides each .reveal in as it scrolls into view, and back out again if
// scrolled past the other way. The first render staggers the elements in (`step` ms
// apart, at most 600 ms, all of it after `base` ms); `quick` is for re-renders
// (typing in the search box, changing a filter), which should just appear, briefly.
export function activateReveal(mount, { quick = false, step = 150, base = 0 } = {}) {
  const items = mount.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in-view'));
    return;
  }

  if (!revealObserver) revealObserver = watcher(0.15, (el, on) => el.classList.toggle('in-view', on));
  items.forEach((el, i) => {
    // custom properties, not an inline transition-delay: the stagger must only
    // apply to the reveal (see .reveal in css/style.css), never to hover effects
    el.style.setProperty('--reveal-delay', quick ? '0s' : `${base + Math.min(i * step, 600)}ms`);
    if (quick) el.style.setProperty('--reveal-dur', '0.3s');
    revealObserver.watch(el);
  });
}

/* ---- headings that rise ----------------------------------------------------------- */

let riseObserver = null;

// "Featured products" -> <span class="rw"><span class="rw-in">Featured</span></span> <span ...>products</span>
// (the CSS clips each word in a box of its own and slides the word up out of it)
function words(el) {
  if (el.querySelector(':scope > .rw')) return false;
  if (el.children.length) return false; // only plain text; anything richer is left as it is
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  if (!text) return false;
  el.textContent = '';
  text.split(' ').forEach((word, i, all) => {
    const box = document.createElement('span');
    box.className = 'rw';
    const inner = document.createElement('span');
    inner.className = 'rw-in';
    inner.style.setProperty('--i', i);
    inner.textContent = word;
    box.appendChild(inner);
    el.appendChild(box);
    if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return true;
}

function rise() {
  if (reduced.matches) return;
  const heads = document.querySelectorAll('.section-head h2, [data-rise]');
  if (!heads.length) return;
  if (!('IntersectionObserver' in window)) return; // no observer: the plain headings stay
  if (!riseObserver) riseObserver = watcher(0.6, (el, on) => el.classList.toggle('in-view', on));
  heads.forEach((h) => {
    // (a language switch puts plain text back: wrap it again, in the state it was in)
    if (words(h)) h.classList.add('rise');
    if (h.classList.contains('rise')) riseObserver.watch(h);
  });
}

/* ---- the progress line -------------------------------------------------------------- */

function progress() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('i');
  bar.appendChild(fill);
  document.body.appendChild(bar);

  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 8 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    bar.classList.toggle('is-on', window.scrollY > 24);
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  // the page grows when the products and the footer arrive: follow it
  if ('ResizeObserver' in window) new ResizeObserver(queue).observe(document.body);
  update();
}

/* ---- start ---------------------------------------------------------------------------- */

function init() {
  progress();
  // the texts are final once the translations are in (and again after a language switch)
  document.addEventListener('translations-ready', rise);
  rise();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
