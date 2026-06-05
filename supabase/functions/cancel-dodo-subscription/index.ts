import { wrapHandler } from "../_shared/response.ts";
// deploy: 20260522151723
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { logError } from "../_shared/logger.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DODO_API_KEY = requireEnv("DODO_PAYMENTS_API_KEY");
const DODO_ENV = (Deno.env.get("DODO_PAYMENTS_ENV") ?? "test_mode") as "test_mode" | "live_mode";
const DODO_BASE = DODO_ENV === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

Deno.serve(wrapHandler(async (req, origin, requestId) => {

  if (req.method === "OPTIONS") return handleOptions(origin);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    // Admin check — must be verified server-side via service role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const body = await req.json().catch(() => ({}));

    // Admins may cancel on behalf of another user, but only with explicit user_id
    const targetUserId: string = (isAdmin && typeof body.user_id === "string" && body.user_id)
      ? body.user_id
      : user.id;

    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, dodo_subscription_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!sub?.dodo_subscription_id) return json({ error: "No active subscription found" }, 404, origin);

    const res = await fetch(`${DODO_BASE}/subscriptions/${sub.dodo_subscription_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const text = await res.text();
    if (!res.ok) {
      logError("dodo cancel error", { status: res.status, text });
      return json({ error: `Dodo Payments error: ${text}` }, 500, origin);
    }

    await admin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", sub.id);

    // Audit log — record who cancelled and on whose behalf
    await admin.from("billing_events").insert({
      user_id: targetUserId,
      subscription_id: sub.id,
      provider: "dodo",
      event_type: "subscription.cancelled",
      provider_event_id: sub.dodo_subscription_id,
      currency: "INR",
      status: "cancelled",
      payload: {
        cancelled_by: user.id,
        admin_action: isAdmin && targetUserId !== user.id,
        reason: body.reason ?? null,
      },
    });

    return json({ ok: true }, 200, origin);
  } catch (e) {
    logError("cancel-dodo-subscription error", e);
    const origin2 = req.headers.get("origin") ?? "";
    return json({ error: e instanceof Error ? e.message : "Unable to cancel" }, 500, origin2);
  }
}));
