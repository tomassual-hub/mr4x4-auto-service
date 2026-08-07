// toyyibpay-webhook: the ONLY place a license actually gets upgraded from a
// real ToyyibPay payment. ToyyibPay POSTs here (form-encoded, not JSON --
// see the Content-Type check below) once a customer completes/fails a
// payment on the bill created by create-toyyibpay-bill. Set this
// function's URL as TOYYIBPAY_BASE_URL's callback target -- see that
// function's own header comment for the shared secrets/deploy steps.
//
// ============================================================================
// IMPORTANT -- UNVERIFIED AGAINST A REAL TOYYIBPAY ACCOUNT
// ============================================================================
// Field names below (status/billcode/refno/order_id) are from ToyyibPay's
// documented callback payload at the time this was written. Test this for
// real against a ToyyibPay SANDBOX bill before trusting it in production --
// see create-toyyibpay-bill's header comment for the same warning.
// ============================================================================
//
// DEPLOY: Dashboard -> Edge Functions -> Deploy a new function -> name it
// exactly `toyyibpay-webhook` -> paste this file. No secrets of its own
// beyond SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (provided automatically) --
// it only ever writes `licenses`, using the license key ToyyibPay hands
// back in `order_id` (set from billExternalReferenceNo when the bill was
// created), never trusting anything else in the payload as an identity.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  try {
    // ToyyibPay's callback is application/x-www-form-urlencoded, not JSON.
    const form = await req.formData();
    const status = form.get("status"); // "1" = success, "2" = pending, "3" = fail, per docs
    const billcode = form.get("billcode");
    const licenseKey = form.get("order_id"); // this is billExternalReferenceNo echoed back
    // See create-toyyibpay-bill: a per-bill secret embedded in the callback
    // URL itself, never returned to the client. licenseKey and billcode are
    // both already visible to the paying shop's own browser (the create-bill
    // response), so matching on those two alone would let anyone POST
    // straight to this public URL and self-upgrade for free without paying
    // -- this is the actual proof the call came from ToyyibPay's own server.
    const verify = new URL(req.url).searchParams.get("verify");

    if (!licenseKey) {
      return new Response("missing order_id", { status: 400 });
    }

    // Only ever act on OUR OWN pending bill for this license -- the
    // billcode + webhook-secret match stops a payment notification for a
    // DIFFERENT bill (or a replayed/forged callback with a guessed
    // order_id) from upgrading a license it doesn't actually belong to.
    const { data: license } = await supabase
      .from("licenses")
      .select("id, toyyibpay_bill_code, toyyibpay_webhook_secret")
      .eq("id", licenseKey)
      .maybeSingle();

    if (
      !license || license.toyyibpay_bill_code !== billcode ||
      !license.toyyibpay_webhook_secret ||
      license.toyyibpay_webhook_secret !== verify
    ) {
      return new Response("bill mismatch", { status: 200 }); // 200 so ToyyibPay doesn't endlessly retry a callback that will never match
    }

    if (status === "1") {
      await supabase.from("licenses").update({
        plan: "pro",
        status: "active",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", licenseKey);
    }
    // status "2" (pending) / "3" (fail): deliberately no-op -- the license
    // stays whatever it already was, no partial/best-effort upgrade on an
    // unconfirmed or failed payment.

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
