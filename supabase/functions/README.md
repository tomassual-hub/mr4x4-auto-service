# Edge Functions

Real Web Push for support chat (see `src/push-notifications.js`) needs one
Edge Function actually running on Supabase's infrastructure -- something
outside this repo's usual "paste SQL into the dashboard" setup, since Edge
Functions are Deno code, deployed separately from the database.

## notify-support-message

Sends a push notification when a new row lands in `support_messages`
(triggered by `notify_new_support_message` in `backend/schema.sql`, via
`pg_net`).

### Deploy

Either:
```
supabase functions deploy notify-support-message
```
(needs the [Supabase CLI](https://supabase.com/docs/guides/cli), logged in
and linked to the project: `supabase link --project-ref <project-ref>`), or
with no CLI at all: Dashboard → Edge Functions → "Deploy a new function" →
name it exactly `notify-support-message` → paste the contents of
`notify-support-message/index.ts`.

### Secrets

Dashboard → Edge Functions → Manage secrets (or `supabase secrets set
NAME=value`):

| Secret | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | Same value as `PUSH_VAPID_PUBLIC_KEY` in `src/push-notifications.js` |
| `VAPID_PRIVATE_KEY` | The matching private half from `npx web-push generate-vapid-keys` — **never** put this in client-side code |
| `VAPID_SUBJECT` | A `mailto:` or `https:` URL identifying the sender, e.g. `mailto:you@example.com` — required by the Web Push spec |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to
every Edge Function — nothing to set for those.

### Point the trigger at it

Once deployed, run this once in the SQL Editor (fill in the real values).
Note this is a table update, not `alter database ... set` -- that needs
superuser, which the SQL Editor's role doesn't have on a managed Supabase
project (`edge_function_config` exists specifically to avoid needing it):
```sql
update edge_function_config set
  edge_function_url = 'https://<project-ref>.functions.supabase.co/notify-support-message',
  edge_function_anon_key = '<this project''s anon key>'
where id = 'singleton';
```
`<project-ref>` is the subdomain in the project's URL (e.g.
`knvevgtoigcteqdinyvk` for `https://knvevgtoigcteqdinyvk.supabase.co`).

Until that's run, `notify_new_support_message` silently no-ops (see its
comment in `backend/schema.sql`) — support chat itself keeps working fine
either way, it just won't push a notification yet.

## create-toyyibpay-bill + toyyibpay-webhook

Real payment for a plan upgrade (see `upgradePlanReal()` in
`src/license.js`). `create-toyyibpay-bill` starts a ToyyibPay bill and
returns a payment URL to redirect to; `toyyibpay-webhook` is what ToyyibPay
calls back once the customer actually pays, and is the ONLY place a
license gets upgraded from a real payment (never from
`create-toyyibpay-bill` directly).

**⚠️ Built from ToyyibPay's publicly documented API, not yet tested
against a real account** (none existed when this was written) — see the
header comment in each file for exactly what to re-verify. Test against a
[ToyyibPay sandbox account](https://dev.toyyibpay.com) end to end before
trusting this with real money.

### Deploy

Same as `notify-support-message` above — Dashboard → Edge Functions →
Deploy a new function → name it exactly `create-toyyibpay-bill` (paste
`create-toyyibpay-bill/index.ts`) and separately `toyyibpay-webhook` (paste
`toyyibpay-webhook/index.ts`).

### Secrets (on `create-toyyibpay-bill` only)

| Secret | Value |
|---|---|
| `TOYYIBPAY_SECRET_KEY` | From your ToyyibPay account settings |
| `TOYYIBPAY_CATEGORY_CODE` | The Category you create in ToyyibPay for ServisPro subscription payments |
| `TOYYIBPAY_BASE_URL` | `https://dev.toyyibpay.com` (sandbox — test here first) or `https://toyyibpay.com` (production) |
| `PUBLIC_APP_URL` | This app's live URL, e.g. `https://tomassual-hub.github.io/servispro/ServisPro.html` |

`toyyibpay-webhook` needs no secrets of its own beyond `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` (provided automatically).

Until `TOYYIBPAY_SECRET_KEY`/`TOYYIBPAY_CATEGORY_CODE`/`TOYYIBPAY_BASE_URL`/
`PUBLIC_APP_URL` are all set, `create-toyyibpay-bill` returns
`{ error: "not_configured" }` and the plan picker's "Pay with ToyyibPay"
button doesn't even show — the existing test-mode upgrade button keeps
working regardless.
