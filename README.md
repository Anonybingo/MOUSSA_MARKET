# Haki Boutique

Static HTML/CSS/JS marketplace for a Rwanda-based clothing boutique —
browse products, contact the seller to negotiate price (no checkout),
track inquiry progress from a dashboard. Same no-build-step approach as
HEALTH: plain files, Firebase for auth/data/hosting, nothing to compile.

Originally built as a generic "Marketplace" and rebranded to Haki
Boutique partway through — real logo (extracted from the shop's flyer),
a warm brown/gold palette in place of the original navy, a hero tagline,
an expanded footer with the shop's actual contact details and delivery
countries, and an instant currency converter (see "Currency conversion"
below). The rebrand only touches presentation — colors, copy, the footer
and header markup, and the logo asset; none of it changes the data model,
Firestore rules, or how any existing feature (auth, inquiries, chat,
admin) works. The logo was later replaced by a high-resolution version
(see "Logo and icons" under "What's built" below).

## What's here

Each page lives in its own folder as `index.html`, so URLs are clean
(`/login/` rather than `login.html`) — this is standard static-hosting
behavior, works automatically on Firebase Hosting and with the local dev
servers below, nothing extra to configure.

```
index.html            Home — hero, search, featured products
products/index.html    Browse — search + category filter
product/index.html      Single product + "Contact us" inquiry form
login/index.html, signup/index.html   Firebase Auth
dashboard/index.html    Signed-in user's own inquiries, with a status stepper
about/index.html       Static about/contact page
admin/index.html       Product catalog + inquiry status management

css/style.css        Design system (warm brown / off-white / gold, from the flyer)
js/firebase-config.js  <- your Firebase project keys go here
js/i18n.js, lang/*.json    Language switching (EN / RW / FR / SW)
js/components.js     Shared header/footer + auth-aware nav
js/currency.js        Location-based currency detection + live price conversion
js/hero-fx.js        Home hero conductor: when to start (after the loader), the clock, input, the loop
js/hero-intro.js     The hero intro (dot, "!", tumbling letters, HAKI -> BOUTIQUE) and the big word
js/hero-dust.js      The gold dust: gathers into the picture; pointer, tap and scroll reactions
js/hero-picture.js   The picture the dust forms (a shirt on a gold hanger, or your own image)
js/loader.js         Loading overlay; announces loader-shown / loader-hidden for the hero
js/card-fx.js        Product-card hover tilt + glare (pulled in by products.js)
js/marquee.js        The gold ticker strip on the home page
js/auth.js, products.js, product-detail.js, dashboard.js, admin.js
assets/logo.png       Haki Boutique logo: transparent high-resolution master (662 x 758)
assets/logo-34.png, logo-68.png, logo-102.png   The navbar's copy of it at 1x / 2x / 3x
assets/icon-192.png, icon-512.png, apple-touch-icon.png, favicon-32.png, favicon.ico   Tab + home-screen icons

firestore.rules       Firestore security rules — deploy these, see below
storage.rules        Storage rules — not deployed/needed right now, see below
admin/imgupload.js    Product image upload to imgbb (used instead of Storage)
```

Every internal link, redirect, and asset reference uses root-absolute
paths (`/products/`, `/js/products.js`, `/lang/en.json`) rather than
relative ones — with pages now sitting at different folder depths, that's
what keeps a shared file like `components.js` correct no matter which
page loaded it. Worth knowing if you add a new page: link to it as
`/newpage/`, not `newpage.html`.

## Setup

**1. Create a Firebase project** — [console.firebase.google.com](https://console.firebase.google.com) → Add project.

**2. Enable Authentication** — Build → Authentication → Get started → enable
the **Email/Password** sign-in provider.

**3. Create Firestore** — Build → Firestore Database → Create database
(start in production mode — the rules below lock it down properly).

**4. Deploy the security rules** — open `firestore.rules` in this project,
copy it into Firestore Database → Rules in the console, and publish. This
is what actually enforces: anyone can browse products, only an admin
account can add/edit/delete products, and a user can only ever see their
own inquiries.

**5. (Optional, not currently used) Storage** — Cloud Storage for Firebase
now requires the pay-as-you-go **Blaze** plan just to turn on, even to stay
within its free-tier usage. Rather than require that, product images
upload to **imgbb** instead (free, no plan upgrade) — see the note under
"What's built" below. `storage.rules` is still in this project and ready
to deploy if you ever do move to Blaze and want to switch to Storage
later; it's not required for the site to work today.

**6. Register a web app** — Project settings (gear icon) → General → Your
apps → Add app → Web. Copy the `firebaseConfig` object it gives you into
`js/firebase-config.js`, replacing the placeholder values.

**7. Set up reCAPTCHA (App Check).** This project uses Firebase App Check
with reCAPTCHA v3 rather than a decorative checkbox, because there's no
backend server here to verify a secret key against — App Check's
verification happens on Firebase's own infrastructure instead.
   - Go to the [reCAPTCHA admin console](https://www.google.com/recaptcha/admin/create), register a **v3** site, add the domain(s) you'll host on (and `localhost` for local dev).
   - Copy the **site key** into `RECAPTCHA_V3_SITE_KEY` in `js/firebase-config.js`.
   - In the Firebase console → Build → App Check → register your web app → reCAPTCHA v3 provider → paste the same site key.
   - **Don't turn on "Enforce" for Authentication/Firestore/Storage yet** — verify locally first (open the browser console; App Check logs a warning if something's misconfigured). Turning on enforcement before it's working correctly will lock everyone, including you, out.

**8. Run it locally.** Because the pages use ES modules and `fetch()` for
the language files, opening `index.html` directly (`file://`) won't work —
browsers block that. Serve the folder instead, e.g. from this directory:

```
npx serve .
```

or

```
python3 -m http.server 8080
```

then visit the printed `localhost` URL.

**9. Create your account, then make yourself admin.** Sign up through the
site once. Then in the Firebase console → Firestore Database → `users`
collection → your user document → set `isAdmin` to `true`. (This one step
is manual on purpose — the security rules block anyone from granting
themselves admin through the app itself.) Log out and back in, and the
"Admin" link appears in the nav.

**10. Add your first products** from the Admin page → Products tab → Add
product — pick an image file directly, it uploads to imgbb for you.

**11. Deploy** — easiest is Firebase Hosting (`firebase init hosting`, then
`firebase deploy`), same as you'd set up for HEALTH.

## What's built vs. what's next

Built in this pass, on top of the original marketplace:

- **Liquid Glass navbar** — translucent blurred header, floating glass
  panel, mobile hamburger menu with the same glass treatment, subtle
  intensification on scroll. Also fixed the bug that was making the header
  (and footer) invisible — the injected markup was never actually getting
  the CSS class it needed; see the inline comment in `components.js` if
  you're curious.
- **Login**: password show/hide toggle, "Forgot password?" using
  Firebase's real reset-email flow, App Check (reCAPTCHA v3) protection.
- **Signup**: password + confirm-password toggles and matching validation.
- **Admin product images**: real file upload with a live preview and
  type/size validation. Uploads go to **imgbb** rather than Firebase
  Storage (`admin/imgupload.js`) — Storage now requires the Blaze plan
  even for free-tier usage, so this avoids that entirely. Worth knowing:
  - The imgbb API key lives in that file in plain view, which is
    unavoidable without adding a backend to proxy the request through —
    imgbb doesn't offer a way to restrict a key to specific domains the
    way some other services do. It's a free key with no billing attached,
    so the realistic risk is someone else using it to upload images
    through your account, not a cost risk. If that ever happens, regenerate
    the key on imgbb and swap it into `imgupload.js`.
  - Replacing or deleting a product doesn't clean up its old imgbb image
    the way the earlier Storage version would have. Not a cost concern on
    imgbb's free tier, just an orphaned file — not worth the added
    complexity to chase down for now.
- **Visual polish pass**: navbar glass retinted for reliable text contrast
  in any lighting (text-shadow added as extra insurance, since the glass
  is intentionally quite see-through) · decorative marketplace icons
  (cart, coins, tag, bag, receipt, card, gift, truck) scattered behind
  the header, bold and drifting on an ambient float animation
  (`.header-decor` in `components.js`/CSS) · hero enlarged to ~86vh with
  a navy/gold gradient that fades to white at the top edge (into the
  header zone) so there's something for the glass to visibly show
  through on first load · product cards and the "Featured products"
  heading fade/slide in as they scroll into view **and back out again**
  scrolling the other way — a real bidirectional toggle, not a one-shot
  animation (`.reveal` class, `activateReveal()` in `products.js`) ·
  a reusable full-screen **loader** with the same falling icons and a
  center spinner (`js/loader.js`), now wired into all 9 pages — shows
  the moment a page starts loading and hides once *that page's* real
  content (data fetch, auth check, or just translations) actually
  resolves, not a fixed delay. Its default text no longer depends on
  translations being loaded yet (that was briefly a bug — it could show
  the literal string "common_loading" on first paint since the loader
  appears before the async translations fetch resolves; it now carries
  its own tiny synchronous language lookup instead).
  All of the above skips automatically for anyone with reduced-motion set.
- **Contact Us — three options, on both sides.** Clicking "Contact us"
  (now in the nav on every page, and still on each product page with
  that product attached) opens one shared modal (`js/contact.js`) with:
  - **Send a Message** — the original per-product inquiry form, now
    generalized to work with or without product context, plus an
    optional phone number field. Requires sign-in, same as before.
  - **Web Chat** — real, live, two-way. `js/chat.js` holds the shared
    Firestore logic (`conversations/{uid}/messages` subcollection,
    `onSnapshot` listeners); `/chat/` is the user-facing thread; the
    Admin page's **Chat** tab lists every conversation and lets you
    reply to any of them — both sides update in real time, no refresh.
  - **WhatsApp** — opens `wa.me` with a pre-filled message (mentions the
    product if there is one). The number is **not in code** — it's a
    Firestore setting you edit from Admin → **Settings**, so changing it
    never needs a code edit or redeploy (`js/settings.js`,
    `settings/general` doc, public read / admin-only write).

  `firestore.rules` covers `conversations` and its `messages` subcollection
  (a user can only ever read/write their own, keyed by their own uid;
  admins can read/write any of them) and `settings` (public read,
  admin-only write).
- **Account menu** replaces the old name-as-link in the nav. Signed-in
  users now see a circular avatar (their profile picture, or a default
  person icon if they haven't uploaded one) instead of their name.
  Clicking it opens a glass dropdown — same frosted look as the navbar
  itself — showing their name, **Settings** (→ `/profile/`), **Terms and
  conditions** (→ `/terms/`, placeholder content, clearly marked to
  replace before launch), and **Log out**, which moved here from its old
  spot as a standalone header button.
- **Profile Settings** (`/profile/`, `js/profile.js`) — reachable from
  the account menu above:
  - **Profile picture** — upload via imgbb (same shared helper as product
    images, factored out into `js/imgbb.js` so the API key lives in one
    place instead of being duplicated per feature), saved to
    `users/{uid}.photoURL`, and reflected in the header avatar right away.
  - **Username** — updates both Firebase Auth's `displayName` and the
    Firestore user doc, and patches the account menu immediately so you
    see the change without a refresh.
  - **Password** — tries the change directly first; if Firebase reports
    the session is too old (`auth/requires-recent-login`), a "current
    password" field appears so you can re-authenticate, then it retries
    automatically. No separate/fake password system — this is Firebase
    Auth's own `updatePassword` and `reauthenticateWithCredential`.

  This needed `firestore.rules` to loosen slightly: users can now update
  their *own* profile doc (name, photo), but a rule still blocks anyone
  from changing their own `isAdmin` field — every update is checked
  against the value already stored, so it can only ever stay the same.
- **Haki Boutique rebrand** — real logo in the header (first cropped and
  cleaned up from the shop's flyer image, since replaced by a
  high-resolution version — see "Logo and icons" below), the color palette swapped
  from navy to a warm brown/gold (same CSS variable names in
  `style.css`, just repointed to new hex values, so every rule that
  already referenced a variable picked up the new look with no
  structural changes) while the main page background stays white as
  asked, a hero tagline ("Style that speaks for you") above the search
  bar, and a footer rebuilt as three columns — brand + tagline, contact
  (phone numbers, WhatsApp, email), and the delivery countries from the
  flyer (Uganda, Kenya, Rwanda, Burundi, Tanzania) — replacing the old
  single-row footer.
- **Instant currency converter** (`js/currency.js`) — prices are stored
  in RWF everywhere in Firestore (unchanged); this only affects what's
  *displayed*:
  - On a visitor's first visit, it asks for location permission and, if
    granted, reverse-geocodes their coordinates to a country and picks
    that country's currency automatically (RWF/UGX/KES/BIF/TZS for the
    flyer's delivery countries, plus USD/EUR/GBP as common majors).
  - If location permission is denied, times out, or isn't available,
    nothing is guessed — it deliberately does **not** fall back to a
    silent IP-based lookup, since re-detecting location right after
    someone declines to share it would quietly undermine that choice.
    It simply stays on RWF until the visitor picks a currency themselves.
  - The **currency switcher** in the header (next to the language
    switcher, same styling) is both the manual fallback and an always-
    available override — changing it updates every visible price
    instantly, no page reload, by firing a `currency-changed` event
    that every page listens for.
  - Conversion rates come from the free, keyless
    [Frankfurter API](https://api.frankfurter.dev/) (cached in
    `localStorage` for 12 hours — rates don't need to be second-fresh,
    and this avoids re-fetching on every page); location → country
    comes from the free, keyless
    [BigDataCloud reverse-geocode API](https://www.bigdatacloud.net/).
    Both are CORS-open, which matters here since this is a static site
    with no backend to proxy the request through.
  - Implementation-wise: any price element renders with a
    `data-price-rwf="<amount>"` attribute instead of pre-formatted text
    (`products.js`, `product-detail.js`); `updatePriceDisplays()` fills
    in every such element in whatever currency is currently selected,
    and gets called once after rendering and again on every
    `currency-changed` event. That split means switching currency never
    needs to re-render product cards from scratch — just re-format the
    numbers already on screen.
  - If you ever want to adjust which countries map to which currency,
    or add more currencies to the manual dropdown, that's all in one
    place: `COUNTRY_TO_CURRENCY` and `CURRENCY_OPTIONS` near the top of
    `js/currency.js`.

- **Logo and icons.** The shop supplied a clean 1024 px logo (gold hanger
  over "HB") on a cream background. It was cut out of that background at
  full resolution — pure background, solid logo, and a thin edge band where
  each pixel's transparency was worked out from how much cream it contains
  and its colour taken from the logo beside it, so no cream halo is left on
  dark or coloured backgrounds — and checked against the shop's own 500 px
  cut-out (they agree to within an edge pixel). Files in `assets/`:
  `logo.png` is the transparent master (662 x 758, use it for anything
  large or printed); `logo-34.png`/`logo-68.png`/`logo-102.png` are the same
  logo at 1x/2x/3x for the navbar (shown 34 px high, chosen by `srcset` in
  `components.js`); `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
  (on cream, because iPhones fill transparency with black), `favicon-32.png`
  and `/favicon.ico` (16/32/48) are the browser-tab and home-screen icons,
  linked from the `<head>` of every page. In the navbar the logo sits on a
  small cream badge (`.site-logo-mark` in `style.css`) because its browns are
  made for a light background — the dark H disappeared on the grey glass; to
  show it bare, delete the badge's `background`, `box-shadow` and `padding`
  lines. To swap the logo again: replace the artwork, then regenerate the
  sizes (any image tool will do; keep the file names and the 1x/2x/3x heights).

- **Home-page motion** — three pieces, all progressive enhancement (the
  page is complete without any of them) and all switched off for visitors
  whose device asks for reduced motion:
  - **Hero: the intro, the word and the dust** (`js/hero-fx.js`,
    `js/hero-intro.js`, `js/hero-dust.js`, `js/hero-picture.js`, the "Hero"
    block of `style.css`). The hero is a dark rounded stage with one
    `<canvas>` behind the copy. The intro follows a developer-portfolio
    reel (its motion was measured frame by frame, then dressed in the shop's
    brown and gold): a gold dot drops, squashes and bounces; a stem falls
    onto it and the two make a "!"; the stem swings and the letters H, A, K
    tumble out of its pivot and land beside it; the "!" is the I of **HAKI**;
    the word flickers and turns letter by letter — HAKI, BAKI, BOKI, BOUI,
    BOUT, BOUTI, BOUTIQ, BOUTIQU, **BOUTIQUE** — and slides down while the
    tagline and the search bar fade in, and gold dust gathers into a shirt on
    a hanger behind the word (the hanger is the logo's). Afterwards a light
    sheen crosses the word every ten seconds; the dust is pushed aside by a
    mouse pointer, thrown by a tap on a touch screen (where it also drifts
    slowly on its own), and disperses as you scroll. The tagline is styled
    like the reel's subtitle: the first half of its words bold white, the rest
    italic gold, in every language. How it behaves:
    - **It starts only after the loader, and it is always the full intro.**
      An inline script in `index.html`'s `<head>` adds `html.hero-fx-armed`
      before first paint (unless reduced motion is set), which parks the stage
      and the copy. The intro starts (`hero-fx-play`) once the translations are
      applied, the web font is in and the loading overlay has gone — about
      0.45 s after `hideLoader()`, i.e. a beat after the overlay has finished
      fading out, so the first thing you see is the dot starting to fall.
      `js/loader.js` dispatches `loader-shown` and `loader-hidden` for this.
      Every load plays it from its first frame, reloads included (an earlier
      version played a shortened repeat for a returning visitor in the same
      tab, which looked like half an animation after a reload; it was
      removed). The intro's clock also waits — and the CSS reveals with it —
      while the overlay is up again (it blinks on a language switch), while
      the tab is hidden, and while the hero is scrolled out of view (a page
      that reloads scrolled down), then carries on. A 4-second safety net
      starts it anyway if nothing reports in (never while the overlay is up),
      and a 6-second timer in the inline script releases the hero as a plain
      page if `hero-fx.js` never loads, so a script failure can't leave it
      hidden.
    - **Skip.** A click or tap on the stage (not on the search box or a link)
      or any key press jumps to the finished picture. Scrolling does not skip.
    - **One clock.** The intro is a pure function of a time T, and T is the
      `currentTime` of a do-nothing Web Animations animation; the CSS reveals
      of the copy are on the same timeline. The canvas and the text therefore
      can't drift apart, and the browser's animation inspector (or
      `document.getAnimations()`) can scrub the whole thing.
    - **Reduced motion, no JS, no canvas.** No intro, no movement. With
      reduced motion the finished picture is drawn once on the canvas;
      without JS or canvas the word BOUTIQUE is plain gold text in the page
      and the copy is simply there.
    - **Cost.** Nothing runs while the hero is off screen. After the intro
      the loop drops to about 25 frames a second unless the pointer, a tap or
      a scroll is moving the dust, and the dust thins out if frames take too
      long (12 000 particles on a computer, 6 000 on a phone).
  - **Product cards** (`js/card-fx.js`, `.product-card` in `style.css`).
    Cards fade and slide in one after another as they scroll into view.
    With a mouse or trackpad, a card then leans away from the pointer (up to
    7°, `MAX_TILT`), a soft highlight follows the pointer across the photo
    and the shadow swings the other way. One delegated listener covers cards
    rendered later (search, filters, language switches); touch devices and
    reduced motion get plain hover styling only. This pass also fixed two
    bugs in the old reveal: the card's own `transition` rule replaced the
    reveal's, so cards popped in instead of fading; and the stagger was an
    inline `transition-delay` that stayed on each card and delayed every
    hover effect afterwards, by up to 0.6 s. The stagger is now a CSS
    variable (`--reveal-delay`) that only affects the reveal. Re-renders
    (typing in the search box, changing a filter) skip the stagger and just
    fade in quickly; only the first render of a grid staggers.
  - **Ticker strip** (`js/marquee.js`, "Marquee strip" in `style.css`). A
    gold band between the hero and "Featured products", scrolling
    continuously: the tagline, the shop's highlights and the four
    languages. The HTML holds one set of items; the script repeats it until
    it spans the screen and clones that group once, so the loop is seamless
    at any width (checked up to 2560 px) and is rebuilt on resize, language
    switch and when the web font lands. Scrolling the page down speeds it up
    and scrolling up reverses it, easing back to its own pace when you stop.
    It pauses on hover, while off screen, on a tap, and from a button that
    only keyboard users ever see (moving text needs a way to stop it —
    WCAG 2.2.2). The six strings it adds are `marquee_*` in `lang/*.json`
    (the tagline and the headline are reused from the hero's keys).

  Where to adjust things: the intro's timing is the `TL` object at the top of
  `hero-intro.js` (seconds) and the words it turns through are `WORDS` there;
  the copy's reveals are the `animation` delays in the "Hero" block of
  `style.css` (3.45 s onward — they are on the intro's clock, so keep them
  in step with `TL.slide`); the pause after the loader is `BEAT_MS` in
  `hero-fx.js`; the dust's amount and strength are in `hero-fx.js` (`N`,
  `AMBIENT`) and `hero-dust.js`. To put your own picture in the dust instead
  of the shirt, add `data-hero-image="/assets/your-picture.png"` to
  `<section class="hero">` in `index.html` (a light subject on a dark or
  transparent background works best; it has to be on the same site). The
  ticker's items are the `<li>`s in `index.html` and its pace is `SPEED` in
  `marquee.js`; tilt strength is `MAX_TILT` in `card-fx.js`. To remove one
  piece: for the hero, delete both the inline arming script and the
  `/js/hero-fx.js` tag in `index.html` (the arming script alone would keep
  the hero's copy hidden for its 6 seconds; without them the hero is the
  plain dark card with BOUTIQUE in gold); for the ticker, delete its
  `<script>` tag and the `<section class="marquee">`; for the card tilt,
  delete the `import './card-fx.js'` line in `products.js`. Nothing else
  depends on them. Browser support: the hero needs canvas 2D, the Web
  Animations API, `IntersectionObserver` and `ResizeObserver` (every browser
  from the last several years; without them it falls back to the plain
  hero); the product cards and ticker use the individual
  `translate`/`scale`/`rotate` properties (Chrome 104+, Safari 14.1+,
  Firefox 72+).

Not built yet:

- Nothing outstanding from this pass — see "Verification" below for
  what was checked before shipping.

## Verification

Before shipping the rebrand + currency work, every file touched in that
pass was checked:

- Every `.js` file parses cleanly as an ES module (`node --check`).
- Every `.html` page has balanced tags (scripted check, not just a
  visual skim).
- `style.css`'s braces balance (400 `{` against 400 `}`, no strays).
- Every `getElementById(...)`/`querySelector('#...')` call in the JS
  matches a real id somewhere in the markup — this is what catches a
  stale reference like the `#nav-user-name` one from an earlier pass
  (fixed; see `profile.js`).
- All four `lang/*.json` files are valid JSON with the exact same 144
  keys as `en.json`, in the same order — no page can end up missing a
  translation in one language but not another. Every key the JS asks
  for (`t('...')`) and every `data-i18n` attribute in the markup exists.
- The new logo, header, hero, currency switcher, and footer were
  rendered (not just read as code) via a headless browser against the
  real stylesheet, to confirm the brown/gold palette, the tagline
  placement, and the three-column footer actually look right and not
  just "should work on paper."

The home-page motion pass was checked by running it, not just reading it.
A scripted headless Chromium loaded the real pages, stylesheet, fonts and
icons against a stubbed Firebase (so no network or account was needed) and
every animation was stepped frame by frame, which makes the timing
checkable instead of "looked fine once":

- The hero, on the real page: the intro played end to end and stepped
  frame by frame against the reel's frames (dot bounce, stem landing, swing,
  tumbling letters, word swap, slide, dust); the finished hero at 360, 390,
  768, 1024, 1280, 1440 and 1920 px wide in all four languages (the copy never
  touches the word, the tagline wraps cleanly, Kinyarwanda and Swahili are the
  longest); click and key skip, and that a small scroll does not skip; a
  pointer pushing the dust aside and it returning, a tap throwing it on a
  phone, scroll dispersal and recovery; the render loop stopping off screen
  and idling at about 20-25 frames a second afterwards (also on a phone).
- The loader hand-off, with a deliberately slow database: nothing of the
  intro exists while the overlay is up; the intro starts about 0.46 s after
  the overlay was hidden, when it is completely gone, with the clock at 0; a
  reload plays the same full intro; the overlay returning mid-intro, a
  hidden tab, and a page restored scrolled down each hold the clock and the
  reveals together and release them afterwards. A screen recording of a
  fresh load shows loader, fade, a calm beat, then the whole intro.
- Reduced motion, no JS, a blocked script and a canvas that can't be created:
  each falls back to a complete, still page.
- The ticker loops without a visible seam at every width tested, speeds up
  and reverses with scrolling, and pauses on hover, off screen, on tap and
  from the keyboard button.
- Cards fade in one after another, hover effects are not delayed, and
  searching re-renders them quickly.
- No console errors or uncaught exceptions on any of it.

What was not covered: only Chromium was available, so Safari and Firefox
are untested. The support notes above come from the specifications, not
from running those browsers, so give them a look on a real iPhone and a
Firefox desktop before launch.

Also fixed while sweeping: `/products/` showed the loading overlay and, if
the product fetch failed, never took it down again — which would have
blocked the whole page. It now uses `try`/`finally` like the home page.

## Translations

EN and FR are solid. Kinyarwanda (`lang/rw.json`) and Swahili
(`lang/sw.json`) are a solid first pass but worth a native-speaker
read-through before this goes live, especially the Kinyarwanda — it's the
one I'd trust least of the four. That includes the six new `marquee_*`
strings for the ticker, which are short but were written the same way.

## Data shapes (for reference)

```
users/{uid}        { name, email, isAdmin, createdAt, photoURL? }
products/{id}       { name, price, category, imageUrl, description, createdAt }
                     price is always stored in RWF — js/currency.js converts
                     it for display only; nothing server-side ever converts it
inquiries/{id}       { productId, productName, productImage, userId, userEmail,
                       userName, message, status, createdAt }
                     status: "pending" -> "responded" -> "negotiating" -> "closed"
settings/general     { whatsappNumber }  — public read, admin-only write
conversations/{uid}/messages/{id}   { from, text, createdAt }  — chat thread
```
