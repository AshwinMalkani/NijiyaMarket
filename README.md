# Nijiya Rankings

A mobile-first app for rating and ranking everything at Nijiya Market with friends.

Live at **https://nijiya.ashwinmalkani.dev** — see [PLAN.md](PLAN.md) for the full spec and the
decisions made while building it.

## How it works

- **Accounts are phone numbers.** Sign up with your number, a 4–6 digit PIN, and the shared invite
  code. No SMS — the invite code is what keeps strangers out.
- **Scan a barcode** to add something. If someone already scanned that product you land on their
  item instead of creating a duplicate; otherwise we try Open Food Facts for the name and photo,
  and fall back to typing it in.
- **Rate 0–10** on a big score dial with notes, a photo, and who you tried it with.
- **Tagging a friend never scores the item for them.** It nudges them to rate it themselves, so
  averages only ever contain scores people actually gave. You can tag friends who haven't signed
  up yet — they inherit every tag waiting for them when they join with that phone number, and the
  login screen greets them with who's been tagging them.
- **Browse the rankings** by section, ranked by our average score, with medal colors for the top
  three and a search box.
- **Fix a category** any time by tapping the section line on an item's page — handy when a scan
  guesses wrong.
- **Share any item** with the button on its page — the native share sheet on a phone, copy-link
  everywhere else. The link deep-links straight to that item; a signed-out friend hits login first
  and lands on the item afterward.

## Development

```sh
npm install
npx wrangler d1 migrations apply nijiya-market --local   # first time only
npm run dev                                              # builds, then serves on :8787
```

`npm run dev` passes no invite code, so signup is open locally. To exercise the gate, run
`npx wrangler dev --var INVITE_CODE:nijiya` instead.

### Tests

```sh
bash scripts/api-check.sh          # API happy path incl. invite → claim → nudge flow
npm run smoke                      # drives the real UI in Chrome at an iPhone viewport
node scripts/companion-check.mjs   # tagging a companion who has no account yet
```

All three expect a dev server on `:8787`. They sign up users and create items, so
they **refuse to run against production** — that would leave test accounts and junk
items in the real database. `ALLOW_PROD=1` overrides the guard if you ever need it.

### Data safety

`npm run deploy` uploads the Worker and assets only; it never touches D1 data.
Schema changes are always a separate, explicit `wrangler d1 migrations apply`.
Redeploying as often as you like is safe.

### Deploy

```sh
npm run deploy               # builds and pushes the Worker
```

Migrations run separately: `npx wrangler d1 migrations apply nijiya-market --remote`.

## Infrastructure

One Cloudflare Worker (Hono) serves both the API and the React SPA.

| Resource | Name |
| --- | --- |
| Worker | `nijiya-market` |
| D1 database | `nijiya-market` |
| R2 bucket | `nijiya-photos` (photos, served via `/img/<key>`) |
| Secret | `INVITE_CODE` — required to sign up |

To change the invite code: `npx wrangler secret put INVITE_CODE`.
