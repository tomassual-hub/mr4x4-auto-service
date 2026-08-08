// ai-suggest-checklist: given a job's description (what the customer said
// is wrong) and the vehicle's model, asks an AI model for likely causes and
// which of this app's fixed inspection checklist items (see INSPECTION_ITEMS
// in src/views/jobs.js) to check first. A starting point for the mechanic,
// never a diagnosis on its own -- the actual checklist is still entered by
// hand, item by item, exactly as before; this only suggests where to look.
//
// Uses Google's Gemini API as the primary model, with Groq as an optional
// fallback -- both specifically because they have real free tiers (no
// credit card, no subscription):
//   https://ai.google.dev/gemini-api/docs/pricing
//   https://console.groq.com/docs/rate-limits
// Free tiers carry real rate limits (a handful of requests per minute,
// capped per day) -- fine for one shop's occasional per-job lookup, not
// something to call in a loop. Groq is only tried if Gemini is unset or
// fails (including a real "AI is busy" rate-limit hit) -- it's a safety
// net, not a load-balancer between the two.
//
// DEPLOY (same process as the other functions here -- see
// supabase/functions/README.md): Dashboard -> Edge Functions -> Deploy a
// new function -> name it exactly `ai-suggest-checklist` -> paste this
// file's contents.
//
// SECRETS (Dashboard -> Edge Functions -> Manage secrets):
//   GEMINI_API_KEY   -- free, from https://aistudio.google.com/apikey
//                       (Google account, no billing needed for the free tier)
//   GROQ_API_KEY     -- optional fallback, free, from
//                       https://console.groq.com/keys (no billing needed
//                       for the free tier). If unset, this function just
//                       behaves as it did before -- Gemini only, no
//                       fallback attempt.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are all
// provided automatically to every Edge Function -- the dashboard actively
// rejects manually setting a secret with the SUPABASE_ prefix, so don't try.
// SUPABASE_ANON_KEY here is used only to verify the CALLER's own session
// server-side (see below), never to bypass RLS.
//
// Until at least one of GEMINI_API_KEY/GROQ_API_KEY is set, this returns
// { error: "not_configured" } (200, not 500) so the client can fall back to
// just hiding the button instead of showing a broken one.
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
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

// Free-tier-eligible as of when this was written -- each provider's model
// lineup changes over time, so if either ever starts 404ing, check the
// current free-tier model name and update the relevant constant (nothing
// else here needs to change):
//   Gemini -- https://ai.google.dev/gemini-api/docs/models
//   Groq   -- https://console.groq.com/docs/models
const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";

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
// whatever language the model guesses from the description's wording.
function langInstruction(lang: unknown): string {
  return lang === "en"
    ? "Reply in English."
    : "Reply in Bahasa Malaysia (everyday spoken register used in Malaysian workshops, not overly formal).";
}

function buildPrompt(safeModel: string, safeDescription: string, lang: unknown): string {
  return (
    `You are helping a car workshop mechanic in Malaysia figure out where ` +
    `to start on a job. Vehicle: ${safeModel || "unknown model"}. ` +
    `Customer's reported problem: "${safeDescription}".\n\n` +
    `Reply with likely causes (short phrases, most likely first, max 4) ` +
    `and which items from this EXACT checklist to inspect first (choose ` +
    `only from this list, max 6, most relevant first):\n` +
    INSPECTION_ITEMS.map((n) => `- ${n}`).join("\n") +
    `\n\nThis is a starting point for the mechanic's own inspection, not ` +
    `a final diagnosis -- keep causes short and practical. ${langInstruction(lang)} ` +
    `Plain text phrases only, no markdown. Respond as a JSON object with ` +
    `exactly two keys: "likelyCauses" (array of strings) and ` +
    `"suggestedItems" (array of strings, only from the checklist above). ` +
    `No extra keys, no text outside the JSON object.`
  );
}

// Gemini occasionally returns 503 ("model overloaded") on a transient basis
// under free-tier load -- one short retry recovers most of those without
// making the mechanic manually retry. A 429 (real rate limit) is not
// retried here since retrying immediately won't help; that's what the Groq
// fallback below is for instead.
async function callGemini(prompt: string): Promise<Response> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
  };
  const res = await fetch(url, init);
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 500));
    return await fetch(url, init);
  }
  return res;
}

// Groq's API is OpenAI-compatible (chat completions) and has no per-field
// schema like Gemini's responseSchema -- response_format:{type:"json_object"}
// only guarantees valid JSON, so the exact key names are enforced via the
// prompt text itself (see buildPrompt above) and re-checked after parsing,
// same as Gemini's output already is below.
async function callGroq(prompt: string): Promise<Response> {
  return await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!GEMINI_API_KEY && !GROQ_API_KEY) {
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

    const prompt = buildPrompt(safeModel, safeDescription, lang);

    let raw: string | null = null;
    let lastError: { error: string; detail?: string } | null = null;

    if (GEMINI_API_KEY) {
      const geminiRes = await callGemini(prompt);
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) raw = text;
        else lastError = { error: "ai_bad_response" };
      } else {
        lastError = geminiRes.status === 429
          ? { error: "rate_limited" }
          : { error: "ai_error", detail: await geminiRes.text() };
      }
    }

    // Only reached if Gemini was unset, or just failed above -- Groq is a
    // fallback, never called in parallel with a successful Gemini reply.
    if (!raw && GROQ_API_KEY) {
      const groqRes = await callGroq(prompt);
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const text = groqData?.choices?.[0]?.message?.content;
        if (text) {
          raw = text;
          lastError = null;
        } else {
          lastError = { error: "ai_bad_response" };
        }
      } else {
        lastError = groqRes.status === 429
          ? { error: "rate_limited" }
          : { error: "ai_error", detail: await groqRes.text() };
      }
    }

    if (!raw) {
      return new Response(JSON.stringify(lastError ?? { error: "ai_error" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    let parsed: { likelyCauses?: unknown; suggestedItems?: unknown };
    try {
      parsed = JSON.parse(raw);
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
