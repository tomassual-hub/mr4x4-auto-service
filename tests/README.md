# Automated test suite

Real browser (Playwright/Chromium) regression tests against the live Supabase
backend. These are not unit tests — they log into a real (disposable) test
account, exercise the actual UI, and assert on the resulting data and DOM,
the same way every bug this project has ever caught was actually found.

## Setup

```
npm install
npx playwright install chromium
```

## Running

```
npm test                # run every test file
node tests/xss-escaping.test.js   # run one file directly
```

Each file exits with code 0 (pass) or 1 (fail), so `npm test` is CI-friendly.

## The test account

Tests log into `sync-test-mr4x4@example.com`, a disposable Admin-role staff
account created specifically for this purpose — **never point these tests at
a real shop's account**, since some tests intentionally corrupt/restore data
to exercise edge cases (e.g. `inventory-po-backup.test.js` restores a
deliberately broken backup file).

Override the account via env vars if you set up your own test account:
```
MR4X4_TEST_EMAIL=you@example.com MR4X4_TEST_PASSWORD=... npm test
```

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
