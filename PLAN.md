# Nijiya Market — Implementation Plan

A Beli-inspired, mobile-first website for rating and ranking items from Nijiya, the Japanese supermarket near Ashwin's apartment. Friends create accounts with their phone number, scan or add items, rate them, tag who they tried them with, attach photos, and browse leaderboards by section (Alcohol, Sweet, Savory).

**Status: built and deployed** to https://nijiya.ashwinmalkani.dev. This document is now both the plan and the record of decisions made during implementation — see the "Decisions made during the build" section for the three that changed the original spec.

---

## 1. Product spec

### Core concepts
- **Item** — a product from Nijiya (e.g., a specific mochi, a canned highball). Belongs to exactly one **section**. Has a name, photo, optional description/price.
- **Section** — category. Seed three: 🍶 Alcohol, 🍡 Sweet, 🍘 Savory. Sections live in the DB so more can be added later (admin-less: any logged-in user can add a section via a small "+ new section" affordance in the add-item flow).
- **Rating** — one per (user, item). Score **0.0–10.0 with one decimal** (Beli-style displayed score), free-text notes, date tried, tagged companions ("tried with"), and optional photos. Re-rating updates the existing rating.
- **Companions & pending ratings** — tagging someone as "tried with" is metadata on the tagger's rating only; it never creates a score for the tagged person and never affects the item average. Instead it creates a **pending rating** for each tagged user: next time they open the site, a card at the top of their feed says "Ashwin said you tried ⟨item⟩ with him — rate it?" with a one-tap path to the score entry. The pending prompt is dismissible and disappears once they rate (or dismiss). Averages only ever contain self-entered scores.
- **Tagging people who haven't signed up** — you can tag a friend before they have an account. "+ Someone new" in the companion picker takes a name and phone number and creates a **placeholder user** (`users.pin_hash IS NULL`). They can be tagged immediately, and pending nudges pile up against that placeholder. When they later sign up **with that same phone number**, signup *claims* the placeholder row instead of creating a new one — so every tag and nudge accumulated while they weren't a user is waiting for them on day one. Placeholders can't log in (no PIN) and show as "· invited" in the picker.
- **Item score** — average of all users' ratings, displayed with one decimal and rater count, Beli-style colored score badge:
  - ≥ 8.0 green, 5.0–7.9 yellow/amber, < 5.0 red, no ratings = gray "—".

### Pages (mobile-first; bottom tab bar like Beli)
1. **Feed (home)** — reverse-chron activity: "Ashwin rated Strong Zero Lemon 8.7 🍶 — with Maya, Dev" with photo thumbnail and notes. Tapping goes to the item.
2. **Browse / Rankings** — section tabs (All / Alcohol / Sweet / Savory), items ranked by average score (rank number, photo, name, score badge, rater count). Search box filtering by name.
3. **Add (+ center tab button)** — the add/rate flow (section 5 below).
4. **Item detail** — big photo, name, section chip, avg score, each friend's rating with notes/companions/photos, and a "Rate it" / "Update my rating" button.
5. **Profile** — your rated items ranked by your own score, per-section counts, log out. Viewing other users' profiles via tapping their name works the same way.
6. **Login/Signup** — see auth below.

### Add / rate flow
- Step 1: **scan the barcode** (primary path), **or** search what's already been added, **or** add by hand: name, section (with "+ new section"), photo, optional price.
- Photos: upload from phone (`<input type="file" accept="image/*">` — mobile browsers offer camera or library). Client-side downscale to max 1600px / JPEG ~0.85 before upload to keep R2 and page weight small.
- Step 2: rate it — score slider/stepper 0–10 in 0.1 steps with the live colored badge, notes, date tried (default today), "tried with" multi-select, optional photo on the rating itself.

### Barcode scanning
- Scanner uses the browser's native `BarcodeDetector` where it exists (Chrome), and lazy-loads ZXing as a WASM/JS fallback everywhere else (Safari/iOS has no `BarcodeDetector`). ZXing is code-split so it only downloads on the browsers that need it.
- A scan resolves in three steps, in priority order:
  1. **An item we already have with that barcode** → jump straight to rating it. This is the dedupe win: the second person to scan a snack lands on the item the first person created instead of making "Strong Zero Lemon (2)".
  2. **Open Food Facts** (free, keyless) → prefill name and product image. Coverage of niche Japanese imports and alcohol is patchy, so a miss here is expected and normal.
  3. **Nothing** → type the name in; it gets saved against that barcode so the next scan hits case 1.
- `items.barcode` has a partial unique index; item creation re-checks for a clash and returns the existing item rather than erroring.

### Auth: phone-number accounts, no SMS at launch
This is a friends-only app; skip Twilio/SMS for v1 to avoid cost and setup. Design:

- **Signup**: enter phone number → if unknown, prompt for display name + a **4–6 digit PIN** + the shared **invite code** (a secret env var Ashwin gives friends; blocks randos). Phone numbers normalized to E.164 (assume +1 default, allow full international entry).
- **Login**: phone + PIN.
- **Session**: on success, set an HttpOnly, Secure, SameSite=Lax cookie containing a random 256-bit token; store its SHA-256 hash in a `sessions` table; 180-day expiry, sliding.
- PIN stored hashed (use `crypto.subtle` PBKDF2, ~100k iterations, per-user salt — no external deps needed on Workers).
- **Rate limiting**: max 5 failed PIN attempts per phone per 15 min (tracked in D1).
- Leave a clean seam (`auth.ts`) so SMS OTP via Twilio Verify can replace the PIN later without touching the rest of the app.

---

## 2. Stack & architecture

- **One Cloudflare Worker** serving both the API and the static frontend (Workers Assets). No separate hosting.
- **Backend**: Hono (TypeScript) on Workers. D1 for data, R2 for photos.
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS. Single-page app, mobile-first. Include a web app manifest + theme color so it installs nicely to the home screen (no service worker needed for v1).
- **Photos**: stored in R2 under `items/<id>/<uuid>.jpg` and `ratings/<id>/<uuid>.jpg`; served through the Worker at `GET /img/<key>` with long-lived cache headers (`Cache-Control: public, max-age=31536000, immutable`).

### Repo layout
```
/               (repo root = this directory)
  PLAN.md
  package.json          (workspaces optional — a single package is fine)
  wrangler.jsonc
  migrations/           (D1 migrations, wrangler-managed)
    0001_init.sql
  src/
    worker/             (Hono app)
      index.ts          (routes mount + assets fallback)
      auth.ts           (signup/login/session middleware, PBKDF2)
      api/              (items, ratings, sections, users, photos)
      db.ts             (typed query helpers)
    web/                (React app, Vite root)
      main.tsx, App.tsx, pages/, components/, lib/api.ts
  public/               (manifest, icons)
```

---

## 3. Database schema (D1 / SQLite) — `migrations/0001_init.sql`

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,          -- E.164
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,              -- pbkdf2$<iter>$<salt_b64>$<hash_b64>
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,         -- sha256 of cookie token
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE login_attempts (
  phone TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🛒',
  sort INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sections (slug, name, emoji, sort) VALUES
  ('alcohol', 'Alcohol', '🍶', 1),
  ('sweet',   'Sweet',   '🍡', 2),
  ('savory',  'Savory',  '🍘', 3);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  description TEXT,
  price_cents INTEGER,
  photo_key TEXT,                      -- R2 key of primary photo
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ratings (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  score REAL NOT NULL CHECK (score >= 0 AND score <= 10),
  notes TEXT,
  tried_on TEXT,                       -- date tried, YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, user_id)
);

CREATE TABLE rating_companions (
  rating_id INTEGER NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (rating_id, user_id)
);

CREATE TABLE pending_ratings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),      -- who should rate
  item_id INTEGER NOT NULL REFERENCES items(id),
  tagged_by INTEGER NOT NULL REFERENCES users(id),    -- who tagged them
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at TEXT,                                  -- null = still pending
  UNIQUE (user_id, item_id)
);

CREATE TABLE rating_photos (
  id INTEGER PRIMARY KEY,
  rating_id INTEGER NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  photo_key TEXT NOT NULL
);

CREATE INDEX idx_ratings_item ON ratings(item_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_items_section ON items(section_id);
```

---

## 4. API (all under `/api`, JSON; session cookie required except auth endpoints)

- `POST /api/auth/check-phone` `{phone}` → `{exists: bool}` (drives signup vs login UI)
- `POST /api/auth/signup` `{phone, name, pin, inviteCode}` → sets cookie
- `POST /api/auth/login` `{phone, pin}` → sets cookie (rate-limited)
- `POST /api/auth/logout`
- `GET  /api/me` → current user
- `GET  /api/users` → all users (for "tried with" picker)
- `GET  /api/sections` / `POST /api/sections` `{name, emoji}`
- `GET  /api/items?section=slug&q=search` → items with avg score, count, my score
- `POST /api/items` `{name, sectionId, description?, priceCents?, photoKey?, barcode?}` — a barcode already on another item returns that item's id instead of creating a duplicate
- `GET  /api/barcode/:code` → `{item, suggestion}` — our item if we have one, else an Open Food Facts lookup, else both null
- `POST /api/users/invite` `{name, phone}` → placeholder user who can be tagged before they sign up
- `GET  /api/items/:id` → item + all ratings (with user names, companions, photos)
- `PUT  /api/ratings/:itemId` `{score, notes?, triedOn?, companionIds?, photoKeys?}` — upsert my rating; for each companion without their own rating of this item, upsert a `pending_ratings` row (skip if they already rated it); rating an item clears my own pending row for it
- `GET  /api/pending` → my undismissed pending ratings (item + who tagged me), shown as cards at the top of the feed
- `POST /api/pending/:id/dismiss`
- `DELETE /api/ratings/:itemId` — remove my rating
- `POST /api/photos` — multipart image upload → `{photoKey}` (validate content-type, 10 MB cap). Also accepts `{photoUrl}` internally, used only to copy a barcode-suggested product image into R2.
- `GET  /api/feed?before=cursor` → recent ratings, paginated (20/page)
- `GET  /api/users/:id/ratings` → a user's ranked list
- `GET  /img/:key+` → stream from R2 with immutable cache headers (no auth required — keys are unguessable UUIDs, keeps `<img>` tags simple)

Validation server-side on everything (score range, name non-empty, section exists). Return 401 consistently so the SPA can redirect to login.

---

## 5. UI / design notes (loosely Beli-inspired)

Per Ashwin: the UI does **not** need to closely mirror Beli — it's inspiration, not a spec. Keep the useful patterns (bottom tab bar, colored score badges, ranked lists) but feel free to diverge on visual style; prioritize a clean, fast, mobile-first design over resemblance.

- **Layout**: max-width ~480px centered column (looks like an app on desktop too), bottom tab bar with 5 slots: Feed · Rankings · **+** (prominent circular center button) · Profile · (spare/Search). Safe-area padding for iOS (`env(safe-area-inset-bottom)`).
- **Score badge**: circular/rounded chip with the number in white on the green/amber/red background; used everywhere consistently.
- **Ranked lists**: rows with rank number, 56px rounded-square photo thumb, name, section emoji, score badge on the right.
- **Feed cards**: avatar-less is fine; "Name · time ago", item photo, score badge, notes, "with X, Y" line.
- Clean, light default theme; system font stack; Tailwind. Skeleton loaders on fetch. Touch targets ≥ 44px.
- `<title>` "Nijiya Rankings", manifest name "Nijiya", a simple 🍙-style icon (generate a PNG or inline SVG icon).

---

## 6. Cloudflare setup & deploy (do these via wrangler in this repo)

1. `npm create` the project scaffolding by hand (don't use a template that fights the layout above). Dev deps: `wrangler` (pin ^4), `vite`, `typescript`, `tailwindcss`, `@vitejs/plugin-react`; deps: `hono`, `react`, `react-dom`.
2. `npx wrangler d1 create nijiya-market` → put the id in `wrangler.jsonc`.
3. `npx wrangler r2 bucket create nijiya-photos`.
4. `wrangler.jsonc`:
   ```jsonc
   {
     "name": "nijiya-market",
     "main": "src/worker/index.ts",
     "compatibility_date": "2026-07-01",
     "assets": { "directory": "dist/web", "not_found_handling": "single-page-application", "binding": "ASSETS" },
     "d1_databases": [{ "binding": "DB", "database_name": "nijiya-market", "database_id": "<from step 2>" }],
     "r2_buckets": [{ "binding": "PHOTOS", "bucket_name": "nijiya-photos" }],
     "routes": [{ "pattern": "nijiya.ashwinmalkani.dev", "custom_domain": true }],
     "workers_dev": false,
     "preview_urls": false
   }
   ```
   (Site is public-internet-reachable but gated by its own login; still disable workers.dev per house convention.)
5. Invite code: `npx wrangler secret put INVITE_CODE` (ask Ashwin for the value at deploy time, or generate one and tell him).
6. Migrations: `npx wrangler d1 migrations apply nijiya-market --remote` (and `--local` for dev).
7. Scripts in package.json: `dev` (`vite build --watch` + `wrangler dev` or just `wrangler dev` with a pre-built bundle — simplest reliable combo: `npm run build && wrangler dev`), `build` (`vite build`), `deploy` (`npm run build && wrangler deploy`).
8. Deploy → https://nijiya.ashwinmalkani.dev (custom_domain route auto-creates DNS).

## 7. Verification before calling it done

- `wrangler dev` locally: sign up (with invite code), add an item with a URL-pulled photo, rate it with a companion tagged, check feed/rankings/profile, log out/in.
- E2E smoke with puppeteer-core against system Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`), iPhone-ish viewport (390×844): signup → add item → rate → assert score badge appears in Rankings. A single script in `scripts/smoke.mjs` is enough.
- After deploy, `curl -I https://nijiya.ashwinmalkani.dev` (200) and repeat the happy path once on prod.
- Commit and push to `origin main` (repo: git@github.com:AshwinMalkani/NijiyaMarket.git). No gh CLI installed; plain git push works.

## 8. Decisions made during the build

Three things changed from the original spec. All three are live.

**1. Companions can be people without accounts.** The first draft required every companion to be a registered user, which meant you couldn't tag Sahil until he signed up — and in practice he never would, so items would sit with one rating. Solved with placeholder users claimed by phone number at signup (details in section 1). Rejected alternative: entering a proxy score on someone's behalf, which would put numbers in the average that the person never actually gave.

**2. Barcode scanning added.** Asked for mid-build; feasible with a native-plus-ZXing-fallback approach (details in section 1). The autofill from Open Food Facts is the advertised feature but the *dedupe* — two people scanning the same product landing on the same item — is the part that actually earns its keep, and it works regardless of external database coverage.

**3. Paste-an-image-URL removed.** Dropped as a user-facing option once scanning landed: between the camera roll and barcode-sourced product images, pasting a link was a third path that nobody would reach for. The server-side URL fetch **stays** — it's what copies an Open Food Facts product image into R2 so those links can't rot. `POST /api/photos {photoUrl}` is now an internal endpoint used only by the scan flow, not a UI affordance.

## 9. Explicit non-goals for v1 (noted for later)

- SMS OTP verification (Twilio Verify) — auth.ts is structured so this can replace the PIN.
- Beli's pairwise-comparison ranking ("which did you like more?") — fun v2; v1 uses direct 0–10 scores.
- Comments/likes on ratings, push notifications.
- Notifying an invited friend that they've been tagged (they find out when they sign up; there's no text or email since we deliberately skipped SMS).

## Environment facts (for the implementing agent)

- Wrangler OAuth already logged in as malkaniashwin@gmail.com, account `<redacted — see local env>`. D1/R2 creation via wrangler works. No auth setup needed.
- Domain `ashwinmalkani.dev` is on this account; `custom_domain: true` routes just work, no manual DNS.
- Do NOT touch existing workers: `villa-ticino-tracker`, `rentals-dad-tracker`, or their D1/R2 resources.
- Node v24, npm 11. No gh CLI. Chrome available for puppeteer-core.
