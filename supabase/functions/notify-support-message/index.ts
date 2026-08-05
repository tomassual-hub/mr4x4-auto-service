// notify-support-message: sends a real Web Push notification for a new
// support chat message (see src/support-chat.js). Invoked by the
// notify_new_support_message trigger in backend/schema.sql, which fires an
// async HTTP call via pg_net on every INSERT into support_messages -- this
// is the only thing that makes a push notification arrive even when the
// app/browser is fully closed; the in-app unread badge alone only helps
// while the app is already open.
//
// DEPLOY: this needs to actually run on Supabase's infrastructure, which
// this environment cannot do by itself -- either:
//   supabase functions deploy notify-support-message
// (needs the Supabase CLI, logged in and linked to the project) or, with no
// CLI at all: Dashboard -> Edge Functions -> "Deploy a new function" ->
// name it exactly `notify-support-message` -> paste this file's contents.
//
// SECRETS (Dashboard -> Edge Functions -> Manage secrets, or
// `supabase secrets set NAME=value`) -- set these three before the first
// real send:
//   VAPID_PUBLIC_KEY   -- same value as PUSH_VAPID_PUBLIC_KEY in
//                         src/push-notifications.js
//   VAPID_PRIVATE_KEY  -- the matching private half (see the header comment
//                         on push_subscriptions in backend/schema.sql for
//                         where both came from -- `npx web-push
//                         generate-vapid-keys`). NEVER put this one in
//                         client-side code.
//   VAPID_SUBJECT      -- a mailto: or https: URL identifying the sender,
//                         required by the Web Push spec, e.g.
//                         mailto:you@example.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime for every function -- nothing to set for those.
//
// After deploying, point the trigger at this function's URL (SQL Editor,
// once):
//   alter database postgres set app.settings.edge_function_url =
//     'https://<project-ref>.functions.supabase.co/notify-support-message';
//   alter database postgres set app.settings.edge_function_anon_key =
//     '<this project's anon key>';
// (<project-ref> is the subdomain in your Supabase project URL, e.g.
// knvevgtoigcteqdinyvk for https://knvevgtoigcteqdinyvk.supabase.co.)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const MANAGER_ROLES = new Set(["Admin", "Pemilik", "Kerani"]);

Deno.serve(async (req) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return new Response(
      JSON.stringify({ error: "VAPID secrets not configured yet" }),
      { status: 200 }, // 200, not 500 -- the trigger's http_post is fire-and-forget and ignores the response either way, but a clear 200 keeps this out of any error-rate alerting until secrets are actually set.
    );
  }

  try {
    const { threadStaffId, senderId, senderName, senderSide, message } =
      await req.json();

    // The recipient is always the OTHER side of the thread, never the
    // sender -- a manager's own reply shouldn't push right back to
    // themselves, and vice versa.
    let recipientStaffIds: string[] = [];
    if (senderSide === "manager") {
      recipientStaffIds = threadStaffId ? [threadStaffId] : [];
    } else {
      const { data: allStaff } = await supabase.from("staff").select(
        "id, data",
      );
      recipientStaffIds = (allStaff ?? [])
        .filter((s: any) =>
          MANAGER_ROLES.has(s.data?.role) && s.id !== senderId
        )
        .map((s: any) => s.id);
    }
    if (recipientStaffIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Fetched whole and filtered here rather than a `data->>staffId=in.()`
    // filter server-side -- this table stays tiny (a handful of staff
    // devices for a single-shop app), and this sidesteps any doubt about
    // exact PostgREST JSON-operator filter syntax through the JS client.
    const { data: allSubs } = await supabase.from("push_subscriptions")
      .select("id, data");
    const subs = (allSubs ?? []).filter((row: any) =>
      recipientStaffIds.includes(row.data?.staffId)
    );

    const notifPayload = JSON.stringify({
      title: senderSide === "manager" ? "Pengurusan" : (senderName || "Staf"),
      body: (message || "").slice(0, 120) || "Mesej baharu",
      tag: "servispro-support-chat",
    });

    let sent = 0;
    for (const row of subs) {
      const sub = row.data?.subscription;
      if (!sub?.endpoint) continue;
      try {
        await webpush.sendNotification(sub, notifPayload);
        sent++;
      } catch (err: any) {
        // 404/410 = the browser/OS has permanently invalidated this
        // subscription (permission revoked, uninstalled, etc.) -- clean it
        // up so future sends stop retrying a push that will never deliver.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq(
            "id",
            row.id,
          );
        }
      }
    }

    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
    });
  }
});
