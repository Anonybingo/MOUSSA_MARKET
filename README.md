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
storage.rules        Storage security rules (product images) — deploy these too
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

**5. Enable Storage and deploy its rules** — Build → Storage → Get
started (default bucket is fine). Then copy `storage.rules` into
Storage → Rules and publish. This is what enforces: anyone can view
product photos, only an admin account can upload or replace one. The
first time you publish a rule that references Firestore from Storage
(this one does, to check `isAdmin`), the console will ask you to approve
connecting the two services — that's expected, confirm it.

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
product — pick an image file directly, it uploads to Storage for you.

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
- **Admin product images**: real file upload to Firebase Storage with a
  preview, type/size validation, and cleanup of the old file when an image
  is replaced or a product is deleted — no more pasting URLs.

Not built yet — flagging clearly rather than shipping something half-done:

- **Contact Us (Inquiry / Web Chat / WhatsApp) as a single menu.** Right
  now the existing per-product inquiry flow (`product.html` → "Contact
  us") still works as before. The 3-option menu, the general-purpose
  inquiry form, the real-time web chat, and the WhatsApp deep link are
  next — web chat in particular is a big enough feature (a new Firestore
  collection, real-time listeners, an admin-side conversation view) that
  it deserves its own pass rather than being rushed in alongside
  everything above.
- **Profile Settings** (`/profile/`) — profile picture upload, username
  change, password change with re-authentication. Also next.
- Once those exist, `firestore.rules` and `storage.rules` need another
  pass to cover the new chat-messages collection and profile pictures.
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
