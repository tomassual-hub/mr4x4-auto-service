// ai-suggest-checklist: given a job's description (what the customer said
// is wrong) and the vehicle's model, asks an AI model for likely causes and
// which of this app's fixed inspection checklist items (see INSPECTION_ITEMS
// in src/views/jobs.js) to check first. A starting point for the mechanic,
// never a diagnosis on its own -- the actual checklist is still entered by
// hand, item by item, exactly as before; this only suggests where to look.
//
// Uses Google's Gemini API specifically because it has a real free tier (no
// credit card, no subscription) -- see
// https://ai.google.dev/gemini-api/docs/pricing. Free tiers carry real rate
// limits (a handful of requests per minute, capped per day) -- fine for one
// shop's occasional per-job lookup, not something to call in a loop.
//
// DEPLOY (same process as the other functions here -- see
// supabase/functions/README.md): Dashboard -> Edge Functions -> Deploy a
// new function -> name it exactly `ai-suggest-checklist` -> paste this
// file's contents.
//
// SECRETS (Dashboard -> Edge Functions -> Manage secrets):
//   GEMINI_API_KEY   -- free, from https://aistudio.google.com/apikey
//                       (Google account, no billing needed for the free tier)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are all
// provided automatically to every Edge Function -- the dashboard actively
// rejects manually setting a secret with the SUPABASE_ prefix, so don't try.
// SUPABASE_ANON_KEY here is used only to verify the CALLER's own session
// server-side (see below), never to bypass RLS.
//
// Until GEMINI_API_KEY is set, this returns { error: "not_configured" }
// (200, not 500) so the client can fall back to just hiding the button
// instead of showing a broken one.
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Supabase's gateway does NOT add CORS headers on its own -- without these,
// the browser's preflight OPTIONS request for this cross-origin call (app
// on github.io, function on supabase.co) gets no Access-Control-Allow-*
// headers back, so the browser silently blocks the real request before it
// ever reaches this function. The client then just sees a generic network
// error. Every response below (including the OPTIONS preflight itself)
// must carry these headers.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

// Free-tier-eligible as of when this was written -- Google's model lineup
// changes over time, so if this ever starts 404ing, check
// https://ai.google.dev/gemini-api/docs/models for the current free-tier
// model name and update this constant (nothing else here needs to change).
const GEMINI_MODEL = "gemini-2.0-flash";

// Must exactly match INSPECTION_ITEMS in src/views/jobs.js -- kept as a
// literal copy rather than imported (this is a standalone Deno function,
// no build step shares code with the main app bundle). If that list ever
// changes, update this one too, or suggestions will reference items the
// checklist UI doesn't actually have.
const INSPECTION_ITEMS = [
  "Minyak Enjin", "Penapis Udara", "Penapis Minyak", "Brek Depan", "Brek Belakang",
  "Tayar & Tekanan Angin", "Bateri", "Wiper & Cecair Pembasuh", "Lampu Depan/Belakang",
  "Talian Kipas & Belt", "Sistem Ekzos", "Cecair Radiator/Coolant", "Suspensi",
  "Minyak Brek", "Minyak Gear/Transmisi", "Air Conditioner (Aircond)",
];

// The app's UI language (state.language in the client) -- staff mostly work
// in Malay, so likely-cause phrases should match rather than default to
// whatever language Gemini guesses from the description's wording.
function langInstruction(lang: unknown): string {
  return lang === "en"
    ? "Reply in English."
    : "Reply in Bahasa Malaysia (everyday spoken register used in Malaysian workshops, not overly formal).";
}

// Gemini occasionally returns 503 ("model overloaded") on a transient basis
// under free-tier load -- one short retry recovers most of those without
// making the mechanic manually retry. A 429 (real rate limit) is not
// retried here since retrying immediately won't help; it's surfaced to the
// client as a distinct "rate_limited" error instead of the generic ai_error.
async function callGemini(body: unknown): Promise<Response> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const res = await fetch(url, init);
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 500));
    return await fetch(url, init);
  }
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  try {
    // Verify the CALLER is a real logged-in staff member, not just anyone
    // holding the (intentionally public) anon key -- this costs a real
    // (free-tier, rate-limited) API call per use, so an anonymous kiosk
    // visitor or a customer-portal account shouldn't be able to trigger it.
    // Uses the caller's own JWT (never the service-role key) so this query
    // runs under their real RLS-scoped session, same trust boundary as
    // every RPC in backend/schema.sql.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }
    const { data: staffRow } = await callerClient.from("staff").select("id")
      .eq("user_id", user.id).maybeSingle();
    if (!staffRow) {
      return new Response(JSON.stringify({ error: "staff_only" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const { description, vehicleModel, lang } = await req.json();
    const safeDescription = String(description ?? "").slice(0, 1000).trim();
    const safeModel = String(vehicleModel ?? "").slice(0, 100).trim();
    if (!safeDescription) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const prompt =
      `You are helping a car workshop mechanic in Malaysia figure out where ` +
      `to start on a job. Vehicle: ${safeModel || "unknown model"}. ` +
      `Customer's reported problem: "${safeDescription}".\n\n` +
      `Reply with likely causes (short phrases, most likely first, max 4) ` +
      `and which items from this EXACT checklist to inspect first (choose ` +
      `only from this list, max 6, most relevant first):\n` +
      INSPECTION_ITEMS.map((n) => `- ${n}`).join("\n") +
      `\n\nThis is a starting point for the mechanic's own inspection, not ` +
      `a final diagnosis -- keep causes short and practical. ${langInstruction(lang)} ` +
      `Plain text phrases only, no markdown.`;

    const geminiRes = await callGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            likelyCauses: { type: "ARRAY", items: { type: "STRING" } },
            suggestedItems: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["likelyCauses", "suggestedItems"],
        },
      },
    });

    if (!geminiRes.ok) {
      if (geminiRes.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      }
      return new Response(
        JSON.stringify({ error: "ai_error", detail: await geminiRes.text() }),
        { status: 200, headers: JSON_HEADERS },
      );
    }

    const geminiData = await geminiRes.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsed: { likelyCauses?: unknown; suggestedItems?: unknown };
    try {
      parsed = JSON.parse(raw ?? "{}");
    } catch {
      return new Response(JSON.stringify({ error: "ai_bad_response" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // Never trust the model to only pick from the list it was given --
    // filter to the checklist's real item names so the client can safely
    // use these to highlight actual checklist rows without a mismatch.
    const suggestedItems = Array.isArray(parsed.suggestedItems)
      ? parsed.suggestedItems.filter((s) =>
        typeof s === "string" && INSPECTION_ITEMS.includes(s)
      ).slice(0, 6)
      : [];
    const likelyCauses = Array.isArray(parsed.likelyCauses)
      ? parsed.likelyCauses.filter((s) => typeof s === "string").map((s) =>
        String(s).slice(0, 200)
      ).slice(0, 4)
      : [];

    return new Response(JSON.stringify({ likelyCauses, suggestedItems }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
