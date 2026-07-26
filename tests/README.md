# Automated test suite

Real browser (Playwright/Chromium) regression tests against a **fully
isolated** Supabase backend. These are not unit tests — they log into a real
(disposable) test account, exercise the actual UI, and assert on the
resulting data and DOM, the same way every bug this project has ever caught
was actually found.

## Setup

```
npm install
npx playwright install chromium
```

## Running

```
npm test                # builds against the test project, then runs every test file
node tests/xss-escaping.test.js   # run one file directly (build:test first if you haven't)
```

Each file exits with code 0 (pass) or 1 (fail), so `npm test` is CI-friendly.

## The isolated test project

`npm test` first runs `npm run build:test`, which builds the app against a
**separate Supabase project** (see `build/build-test.js`) — not the one the
live shop uses — into `tests/.test-build/` (gitignored), and `appUrl()` in
`helpers.js` always loads that file. This isolation is not theoretical: a
restore-related bug earlier in this project's history actually deleted the
real shop's Admin staff record when tests and production shared one backend.
It's now structurally impossible for a test to touch real shop data, no
matter what a test does.

Tests log into `sync-test-mr4x4@mailinator.com` on that isolated project — a
disposable Admin-role account bootstrapped there specifically for this
purpose (mailinator.com, not example.com, because Supabase's email validator
rejects the RFC 2606 reserved example.com domain outright). Some tests
intentionally corrupt/restore data to exercise edge cases (e.g.
`inventory-po-backup.test.js` restores a deliberately broken backup file) —
that's exactly the kind of thing this isolation protects against.

Override the account via env vars if you set up your own:
```
MR4X4_TEST_EMAIL=you@example.com MR4X4_TEST_PASSWORD=... npm test
```

To point at yet another Supabase project (e.g. everyone runs their own),
edit the `SUPABASE_URL`/`SUPABASE_ANON_KEY` in `build/build-test.js` and run
`backend/schema.sql` there once via its SQL Editor.

## What's covered

| File | Covers |
|---|---|
| `syntax-check.test.js` | Every inline `<script>` block parses (no browser needed) |
| `xss-escaping.test.js` | Stored-XSS regression guard across every user-data field |
| `modal-reference-identity.test.js` | Realtime updates merge in place, don't detach an open modal's object reference |
| `toast-modal-safety.test.js` | Toasts never trigger a full render() that could wipe an open modal's fields |
| `local-date.test.js` | "Today" comparisons use local calendar day, not UTC |
| `job-pos-invoice.test.js` | Job → POS → checkout: inventory deduction, invoice/job linkage, sync |
| `inventory-po-backup.test.js` | Inventory/supplier/PO receive flow; backup export → restore round-trip; hardened restore against missing fields and admin self-lockout |
| `reports-cash-inspection.test.js` | P&L/commission math verified against known values; cash-closure reconciliation; job inspection checklist |
| `branch-and-appointments.test.js` | Branch switcher + per-branch filtering; appointments/contracts/staff CRUD; settings-conflict warning |

Every test cleans up the records it creates, and cross-checks two devices
(two `browser.newPage()` sessions) where the feature under test involves
realtime sync.

## Why not a mocked/unit-test suite instead

Every real bug found in this app so far (a render() wiping an open modal, a
realtime update detaching an object reference, a UTC/local date mismatch,
missing HTML-escaping) was invisible to code review and only caught by
actually running the app in a browser and checking the live DOM/state after
a genuine async round-trip. A unit-test suite around isolated functions
would not have caught any of them — the bugs were all in how pieces
interact at runtime, not in any single function's logic.
