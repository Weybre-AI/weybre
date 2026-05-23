// deploy: 20260522151723
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUser } from "../_shared/auth.ts";
import { handleOptions, isOriginAllowed, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DODO_API_KEY = Deno.env.get("DODO_PAYMENTS_API_KEY")!;
const DODO_ENV = (Deno.env.get("DODO_PAYMENTS_ENV") ?? "test_mode") as "test_mode" | "live_mode";
const DODO_BASE = DODO_ENV === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

const PRODUCT_IDS: Record<string, string | undefined> = {
  // New plans
  starter:      Deno.env.get("DODO_PRODUCT_ID_STARTER") ?? Deno.env.get("DODO_PRODUCT_ID_SOLO"),
  professional: Deno.env.get("DODO_PRODUCT_ID_PROFESSIONAL"),
  firm:         Deno.env.get("DODO_PRODUCT_ID_FIRM"),
  // Legacy
  solo:         Deno.env.get("DODO_PRODUCT_ID_SOLO"),
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") return handleOptions(origin);
  try {
    if (!DODO_API_KEY) return json({ error: "Dodo Payments is not configured" }, 500, origin);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    if (!user?.email) return json({ error: "Unauthorized" }, 401, origin);

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as string;
    const productId = PRODUCT_IDS[plan];
    if (!plan || !productId) return json({ error: `Invalid plan or missing DODO_PRODUCT_ID_${(plan ?? "").toUpperCase()}` }, 400, origin);

    const returnOrigin = isOriginAllowed(origin) ? origin : "https://weybre.com";
    const returnUrl = `${returnOrigin}/app?checkout=success`;

    const profile = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const fullName = profile.data?.full_name ?? user.user_metadata?.full_name ?? user.email.split("@")[0];

    // Direct REST call to Dodo Payments — create subscription with hosted payment link
    const payload = {
      product_id: productId,
      quantity: 1,
      payment_link: true,
      return_url: returnUrl,
      billing: {
        country: "IN",
        state: "Karnataka",
        city: "Bengaluru",
        street: "—",
        zipcode: "560001",
      },
      customer: { email: user.email, name: fullName },
      metadata: { user_id: user.id, plan, product: "Weybre AI" },
    };

    const dodoRes = await fetch(`${DODO_BASE}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const dodoText = await dodoRes.text();
    if (!dodoRes.ok) {
      console.error("dodo error", dodoRes.status, dodoText);
      return json({ error: `Dodo Payments error: ${dodoText}` }, 500, origin);
    }
    const session = JSON.parse(dodoText);
    const checkoutUrl: string | undefined = session.payment_link ?? session.checkout_url ?? session.url;
    if (!checkoutUrl) {
      console.error("dodo response missing payment_link", session);
      return json({ error: "Dodo Payments did not return a checkout URL" }, 500, origin);
    }

    const { data: saved, error } = await admin
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        plan,
        status: "incomplete",
        checkout_status: "created",
        trial_end: null,
        dodo_subscription_id: session.subscription_id ?? null,
        dodo_customer_id: session.customer?.customer_id ?? null,
        cancelled_at: null,
      }, { onConflict: "user_id" })
      .select("id")
      .single();
    if (error) throw error;

    await admin.from("billing_events").insert({
      user_id: user.id,
      subscription_id: saved.id,
      provider: "dodo",
      event_type: "subscription.created",
      provider_event_id: session.subscription_id ?? null,
      currency: "INR",
      status: "created",
      payload: session,
    });

    return json({ checkout_url: checkoutUrl }, 200, origin);
  } catch (e) {
    console.error("create-dodo-checkout error", e);
    const origin2 = req.headers.get("origin") ?? "";
    return json({ error: e instanceof Error ? e.message : "Unable to start checkout" }, 500, origin2);
  }
});
