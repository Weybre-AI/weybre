// deploy: 20260522151723
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Webhook endpoint is called by Dodo Payments servers only — no browser origin needed.
// Restrict CORS to disallow arbitrary browser cross-origin calls.
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.dodopayments.com",
  "Access-Control-Allow-Headers": "webhook-id, webhook-signature, webhook-timestamp, content-type",
};

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DODO_WEBHOOK_KEY = requireEnv("DODO_PAYMENTS_WEBHOOK_KEY");

// Replay-attack window: reject webhooks older than 5 minutes
const WEBHOOK_TOLERANCE_SECONDS = 300;

async function verifyStandardWebhook(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  // Reject stale timestamps to prevent replay attacks
  const tsSeconds = parseInt(timestamp, 10);
  if (isNaN(tsSeconds)) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - tsSeconds;
  if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS || ageSeconds < -30) return false;

  // Dodo / standard-webhooks: secret is "whsec_<base64>"
  const secretB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const sigBuf = await crypto.subtle.sign("HMAC", key, data);
  const expected = encodeBase64(new Uint8Array(sigBuf));
  return signatureHeader.split(" ").some((p) => p.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!DODO_WEBHOOK_KEY) return json({ error: "Webhook key not configured" }, 500);

    const raw = await req.text();
    const id = req.headers.get("webhook-id") ?? "";
    const ts = req.headers.get("webhook-timestamp") ?? "";
    const sig = req.headers.get("webhook-signature") ?? "";

    if (!id || !ts || !sig) return json({ error: "Missing webhook headers" }, 400);

    const ok = await verifyStandardWebhook(DODO_WEBHOOK_KEY, id, ts, raw, sig);
    if (!ok) return json({ error: "Invalid webhook signature" }, 401);

    const event = JSON.parse(raw);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const eventType: string = event.type ?? "";
    const data = event.data ?? {};
    const metadata = data.metadata ?? {};
    const subId: string | undefined = data.subscription_id ?? data.id;
    const customerId: string | undefined = data.customer?.customer_id;
    const userIdFromMeta: string | undefined = metadata.user_id;
    const VALID_PLANS = new Set(["starter", "professional", "firm", "solo"]);
    const planRaw = metadata.plan as string | undefined;
    const planFromMeta = planRaw && VALID_PLANS.has(planRaw) ? planRaw : undefined;

    let subRow: { id: string; user_id: string } | null = null;
    if (subId) {
      const r = await admin.from("subscriptions").select("id, user_id").eq("dodo_subscription_id", subId).maybeSingle();
      if (r.data) subRow = r.data;
    }
    if (!subRow && userIdFromMeta) {
      const r = await admin.from("subscriptions").select("id, user_id").eq("user_id", userIdFromMeta).maybeSingle();
      if (r.data) subRow = r.data;
    }

    const updates: Record<string, unknown> = {};
    if (subId) updates.dodo_subscription_id = subId;
    if (customerId) updates.dodo_customer_id = customerId;
    if (planFromMeta) updates.plan = planFromMeta;

    switch (eventType) {
      case "subscription.active":
      case "subscription.renewed":
        updates.status = "active";
        updates.checkout_status = "paid";
        updates.last_payment_at = new Date().toISOString();
        if (data.next_billing_date) updates.current_period_end = new Date(data.next_billing_date).toISOString();
        break;
      case "subscription.cancelled":
      case "subscription.expired":
        updates.status = "cancelled";
        updates.cancelled_at = new Date().toISOString();
        break;
      case "subscription.on_hold":
      case "subscription.failed":
        updates.status = "past_due";
        updates.checkout_status = "payment_failed";
        break;
      case "payment.succeeded":
        updates.last_payment_at = new Date().toISOString();
        if (data.payment_id) updates.dodo_payment_id = data.payment_id;
        break;
    }

    if (subRow && Object.keys(updates).length) {
      await admin.from("subscriptions").update(updates).eq("id", subRow.id);
    } else if (!subRow && userIdFromMeta && eventType.startsWith("subscription.")) {
      await admin.from("subscriptions").upsert({
        user_id: userIdFromMeta,
        plan: planFromMeta ?? "solo",
        status: (updates.status as unknown) ?? "incomplete",
        ...updates,
      }, { onConflict: "user_id" });
    }

    await admin.from("billing_events").insert({
      user_id: subRow?.user_id ?? userIdFromMeta ?? "00000000-0000-0000-0000-000000000000",
      subscription_id: subRow?.id ?? null,
      provider: "dodo",
      event_type: eventType || "webhook",
      provider_event_id: id || subId || null,
      amount: data.recurring_pre_tax_amount ?? data.total_amount ?? null,
      currency: data.currency ?? "INR",
      status: data.status ?? "received",
      payload: event,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("dodo-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "Webhook failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
