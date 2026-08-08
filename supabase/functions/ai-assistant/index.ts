// ai-assistant: a general-purpose AI chat for shop staff -- deliberately
// standalone, not wired into any specific job/work order or existing
// screen (that's what makes it different from ai-suggest-checklist, which
// is scoped to one job's own description). Answers general automotive/
// workshop questions (specs, procedures, terminology, etc.) using the
// model's own knowledge -- it has no access to this shop's own data
// (no db reads here at all beyond verifying the caller is real staff).
//
// Uses Google's Gemini API specifically because it has a real free tier (no
// credit card, no subscription) -- see
// https://ai.google.dev/gemini-api/docs/pricing. Free tiers carry real rate
// limits (a handful of requests per minute, capped per day) -- fine for
// occasional staff questions, not something to call in a loop.
//
// DEPLOY (same process as the other functions here -- see
// supabase/functions/README.md): Dashboard -> Edge Functions -> Deploy a
// new function -> name it exactly `ai-assistant` -> paste this file's
// contents.
//
// SECRETS (Dashboard -> Edge Functions -> Manage secrets):
//   GEMINI_API_KEY -- free, from https://aistudio.google.com/apikey
//                     (Google account, no billing needed for the free tier)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are all
// provided automatically to every Edge Function -- the dashboard actively
// rejects manually setting a secret with the SUPABASE_ prefix, so don't try.
//
// Until GEMINI_API_KEY is set, this returns { error: "not_configured" }
// (200, not 500) so the client can show a clear "not available yet" state.
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Free-tier-eligible as of when this was written -- Google's model lineup
// changes over time, so if this ever starts 404ing, check
// https://ai.google.dev/gemini-api/docs/models for the current free-tier
// model name and update this constant (nothing else here needs to change).
const GEMINI_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT =
  "You are a helpful assistant for staff at a car workshop in Malaysia. " +
  "Answer questions about vehicle specs, repair procedures, parts " +
  "terminology, and general workshop know-how, clearly and practically. " +
  "You have no access to this specific shop's own records (customers, " +
  "jobs, inventory) -- if asked about those, say so and suggest checking " +
  "the app directly instead of guessing. Keep answers concise.";

const MAX_TURNS = 12; // caps both the request payload size and Gemini's own context/cost per call

Deno.serve(async (req) => {
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 200,
    });
  }

  try {
    // Same staff-only verification as ai-suggest-checklist -- this costs a
    // real (free-tier, rate-limited) API call per message.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 200,
      });
    }
    const { data: staffRow } = await callerClient.from("staff").select("id")
      .eq("user_id", user.id).maybeSingle();
    if (!staffRow) {
      return new Response(JSON.stringify({ error: "staff_only" }), {
        status: 200,
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 200,
      });
    }
    // Trust nothing about shape/size from the client -- coerce every turn
    // to a real {role, text} pair and cap both turn count and per-message
    // length before it ever reaches the prompt.
    const turns = messages.slice(-MAX_TURNS).map((m: any) => ({
      role: m?.role === "ai" ? "model" : "user",
      text: String(m?.text ?? "").slice(0, 2000),
    })).filter((m: { text: string }) => m.text.trim().length > 0);
    if (turns.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 200,
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: turns.map((m) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
        }),
      },
    );

    if (!geminiRes.ok) {
      return new Response(
        JSON.stringify({ error: "ai_error", detail: await geminiRes.text() }),
        { status: 200 },
      );
    }

    const geminiData = await geminiRes.json();
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      return new Response(JSON.stringify({ error: "ai_bad_response" }), {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ reply: String(reply).slice(0, 4000) }), {
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
    });
  }
});
