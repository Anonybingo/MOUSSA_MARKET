# Marketplace

Static HTML/CSS/JS marketplace — browse products, contact the seller to
negotiate price (no checkout), track inquiry progress from a dashboard.
Same no-build-step approach as HEALTH: plain files, Firebase for
auth/data/hosting, nothing to compile.

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

css/style.css        Design system (navy / off-white / gold, from the mockup)
js/firebase-config.js  <- your Firebase project keys go here
js/i18n.js, lang/*.json    Language switching (EN / RW / FR / SW)
js/components.js     Shared header/footer + auth-aware nav
js/auth.js, products.js, product-detail.js, dashboard.js, admin.js

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
  center spinner (`js/loader.js` — `showLoader()`/`hideLoader()`, not
  wired into anything by default, drop it in wherever there's a wait).
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
    Admin page's new **Chat** tab lists every conversation and lets you
    reply to any of them — both sides update in real time, no refresh.
  - **WhatsApp** — opens `wa.me` with a pre-filled message (mentions the
    product if there is one). **Set your number first**: `WHATSAPP_NUMBER`
    in `js/firebase-config.js` is still a placeholder — digits only,
    country code, no `+`, e.g. a Rwanda number would look like
    `"2507XXXXXXXX"`.
  
  `firestore.rules` now covers `conversations` and its `messages`
  subcollection: a user can only ever read/write their own conversation
  (keyed by their own uid), admins can read/write any of them.

Not built yet — flagging clearly rather than shipping something half-done:

- **Profile Settings** (`/profile/`) — profile picture upload (via imgbb,
  same as product images), username change, password change with
  re-authentication.
- A full responsive/QA sweep across every page is worth doing once, at
  the end, rather than piecemeal after each feature.

## Translations

EN and FR are solid. Kinyarwanda (`lang/rw.json`) and Swahili
(`lang/sw.json`) are a solid first pass but worth a native-speaker
read-through before this goes live, especially the Kinyarwanda — it's the
one I'd trust least of the four.

## Data shapes (for reference)

```
users/{uid}        { name, email, isAdmin, createdAt }
products/{id}       { name, price, category, imageUrl, description, createdAt }
inquiries/{id}       { productId, productName, productImage, userId, userEmail,
                       userName, message, status, createdAt }
                     status: "pending" -> "responded" -> "negotiating" -> "closed"
```
