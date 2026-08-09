# Marketplace

Static HTML/CSS/JS marketplace — browse products, contact the seller to
negotiate price (no checkout), track inquiry progress from a dashboard.
Same no-build-step approach as HEALTH: plain files, Firebase for
auth/data/hosting, nothing to compile.

## What's here

```
index.html         Home — hero, search, featured products
products.html       Browse — search + category filter
product.html         Single product + "Contact us" inquiry form
login.html / signup.html   Firebase Auth
dashboard.html       Signed-in user's own inquiries, with a status stepper
about.html          Static about/contact page
admin.html          Product catalog + inquiry status management

css/style.css        Design system (navy / off-white / gold, from the mockup)
js/firebase-config.js  <- your Firebase project keys go here
js/i18n.js, lang/*.json    Language switching (EN / RW / FR / SW)
js/components.js     Shared header/footer + auth-aware nav
js/auth.js, products.js, product-detail.js, dashboard.js, admin.js

firestore.rules       Security rules — deploy these, see below
```

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

**5. Register a web app** — Project settings (gear icon) → General → Your
apps → Add app → Web. Copy the `firebaseConfig` object it gives you into
`js/firebase-config.js`, replacing the placeholder values.

**6. Run it locally.** Because the pages use ES modules and `fetch()` for
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

**7. Create your account, then make yourself admin.** Sign up through the
site once. Then in the Firebase console → Firestore Database → `users`
collection → your user document → set `isAdmin` to `true`. (This one step
is manual on purpose — the security rules block anyone from granting
themselves admin through the app itself.) Log out and back in, and the
"Admin" link appears in the nav.

**8. Add your first products** from the Admin page → Products tab → Add
product.

**9. Deploy** — easiest is Firebase Hosting (`firebase init hosting`, then
`firebase deploy`), same as you'd set up for HEALTH.

## Simplifications worth knowing about

Built fast, so a few things from the original plan are intentionally not
in yet:

- **Product images are a URL field, not a file upload.** Paste a hosted
  image link for now. Wiring this to Firebase Storage (real upload button)
  is a natural next step.
- **No App Check or reCAPTCHA yet.** The Firestore rules are the real
  security boundary and are live; App Check/reCAPTCHA just add
  bot/abuse resistance on top and can be layered in later.
- **No email/WhatsApp notification on new inquiries yet** — right now a
  new inquiry only shows up when you check the Admin → Inquiries tab.

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
