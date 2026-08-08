// create-toyyibpay-bill: starts a real ToyyibPay payment for a plan
// upgrade. Called by upgradePlanReal() in src/license.js when a shop clicks
// "Bayar dengan ToyyibPay" in the plan picker -- returns a payment URL the
// client redirects the browser to; ToyyibPay itself then POSTs the actual
// payment result to toyyibpay-webhook (see that function) once the
// customer pays, which is the ONLY place a license actually gets upgraded.
// This function never upgrades anything itself -- it only starts a bill.
//
// ============================================================================
// IMPORTANT -- UNVERIFIED AGAINST A REAL TOYYIBPAY ACCOUNT
// ============================================================================
// This was written from ToyyibPay's publicly documented API
// (https://toyyibpay.com/apireference/) at the time this file was created,
// but there is no real ToyyibPay account to test it against yet -- ToyyibPay
// occasionally changes field names/response shapes between API versions.
// BEFORE relying on this in production:
//   1. Create a free ToyyibPay sandbox account (https://dev.toyyibpay.com)
//      and get a sandbox Secret Key + Category Code.
//   2. Set TOYYIBPAY_BASE_URL to https://dev.toyyibpay.com (sandbox) first,
//      run a real test payment end to end, THEN switch to
//      https://toyyibpay.com for production.
//   3. Re-check the request field names below (billAmount, billTo, etc.)
//      and the response shape (`data[0].BillCode`) against the CURRENT
//      apireference page -- fix anything that's changed before going live.
// ============================================================================
//
// DEPLOY (same process as notify-support-message -- see
// supabase/functions/README.md): Dashboard -> Edge Functions -> Deploy a
// new function -> name it exactly `create-toyyibpay-bill` -> paste this file.
//
// SECRETS (Dashboard -> Edge Functions -> Manage secrets):
//   TOYYIBPAY_SECRET_KEY    -- from your ToyyibPay account settings
//   TOYYIBPAY_CATEGORY_CODE -- the Category you created in ToyyibPay for
//                              ServisPro subscription payments
//   TOYYIBPAY_BASE_URL      -- https://dev.toyyibpay.com (sandbox, test
//                              first) or https://toyyibpay.com (production)
//   PUBLIC_APP_URL          -- this app's own live URL (e.g.
//                              https://tomassual-hub.github.io/servispro/ServisPro.html)
//                              -- used for the return/callback URLs below
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Until these secrets are set, this returns { error: "not configured" }
// (200, not 500) so the client falls back to the existing test-mode
// upgrade button instead of showing a broken "Pay" button.
import { createClient } from "npm:@supabase/supabase-js@2";

const SECRET_KEY = Deno.env.get("TOYYIBPAY_SECRET_KEY") ?? "";
const CATEGORY_CODE = Deno.env.get("TOYYIBPAY_CATEGORY_CODE") ?? "";
const BASE_URL = Deno.env.get("TOYYIBPAY_BASE_URL") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";

// Supabase's gateway does NOT add CORS headers on its own -- without these,
// the browser's preflight OPTIONS request for this cross-origin call (app
// on github.io, function on supabase.co) gets no Access-Control-Allow-*
// headers back, so the browser silently blocks upgradePlanReal()'s real
// request before it ever reaches this function. Same bug class already
// found and fixed in ai-assistant/ai-suggest-checklist -- see those files.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

// Keep this in sync with PLAN_PRICE_MYR in src/license.js.
const PLAN_PRICE_MYR: Record<string, number> = { free: 0, pro: 50 };

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!SECRET_KEY || !CATEGORY_CODE || !BASE_URL || !PUBLIC_APP_URL) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  try {
    const { licenseKey, plan, shopName } = await req.json();
    const price = PLAN_PRICE_MYR[plan];
    if (!licenseKey || !price || price <= 0) {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // billExternalReferenceNo carries the license key through to the
    // webhook (see toyyibpay-webhook) so we know which shop to upgrade
    // once ToyyibPay confirms payment -- this is the only link between the
    // bill and this specific license, so it must survive the round trip.
    //
    // webhookSecret is a second, server-only secret for the SAME purpose
    // ToyyibPay's own signature would serve if it sent one: this app's own
    // browser already learns licenseKey+billCode from THIS response, so
    // trusting those two alone on the webhook side would let anyone just
    // POST straight to the public webhook URL and self-upgrade for free.
    // Never returned to the client -- only ever sent server-to-server, as
    // part of the callback URL ToyyibPay itself POSTs back to.
    const webhookSecret = crypto.randomUUID();
    const form = new URLSearchParams({
      userSecretKey: SECRET_KEY,
      categoryCode: CATEGORY_CODE,
      billName: `ServisPro ${plan}`,
      billDescription: `Naik taraf pelan ServisPro ke ${plan}`,
      billPriceSetting: "1",
      billPayorInfo: "1",
      billAmount: String(Math.round(price * 100)), // ToyyibPay wants cents
      billReturnUrl: `${PUBLIC_APP_URL}?paid=1`,
      billCallbackUrl:
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/toyyibpay-webhook?verify=${webhookSecret}`,
      billExternalReferenceNo: licenseKey,
      billTo: shopName || "Kedai ServisPro",
      billEmail: "no-reply@example.com", // ToyyibPay requires a value here even though this app doesn't collect shop email
      billPhone: "0000000000",
      billSplitPayment: "0",
      billPaymentChannel: "0", // FPX only -- verify this is still the right value in the current apireference
      billDisplayMerchantInfo: "1",
      billContentEmail: "Terima kasih kerana menaik taraf pelan ServisPro anda.",
      billChargeToCustomer: "1",
    });

    const res = await fetch(`${BASE_URL}/index.php/api/createBill`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    // Response shape per ToyyibPay docs: [{ BillCode: "..." }] on success.
    // VERIFY this still matches -- see the header comment above.
    const billCode = Array.isArray(data) && data[0] ? data[0].BillCode : null;
    if (!billCode) {
      return new Response(
        JSON.stringify({ error: "toyyibpay_error", detail: data }),
        { status: 200, headers: JSON_HEADERS },
      );
    }

    // Record the pending bill (+ its webhook secret) so the webhook has
    // somewhere to write the eventual result even before payment completes
    // -- also lets a shop retry/see "payment pending" instead of the
    // licenses row just sitting unchanged with no trace a bill was ever
    // created.
    await supabase.from("licenses").update({
      toyyibpay_bill_code: billCode,
      toyyibpay_webhook_secret: webhookSecret,
    }).eq("id", licenseKey);

    return new Response(
      JSON.stringify({ billCode, paymentUrl: `${BASE_URL}/${billCode}` }),
      { status: 200, headers: JSON_HEADERS },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
