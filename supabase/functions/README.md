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
