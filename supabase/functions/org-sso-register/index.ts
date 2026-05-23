// deploy: 20260522151723
// Register a per-organization SAML SSO provider via the Supabase Admin API.
// Body: { organization_id, metadata_url, email_domain, default_role?, role_mappings? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { corsHeaders, handleOptions, json as corsJson } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200, origin = "") {
  return corsJson(body, status, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const organization_id = String(body.organization_id ?? "");
    const metadata_url = String(body.metadata_url ?? "");
    const email_domain = String(body.email_domain ?? "").toLowerCase().trim();
    const default_role = (body.default_role ?? "member") as "owner" | "admin" | "member";
    const role_mappings = body.role_mappings ?? {};

    if (!organization_id || !metadata_url || !email_domain) {
      return json({ error: "organization_id, metadata_url, email_domain required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: caller must be admin/owner of that organization
    const { data: ok } = await admin.rpc("has_org_role", {
      _org: organization_id, _user: user.id, _min: "admin",
    });
    if (!ok) return json({ error: "Forbidden" }, 403);

    // Register SAML provider via GoTrue Admin SSO API
    const ssoRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/sso/providers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "saml",
        metadata_url,
        domains: [email_domain],
      }),
    });
    const ssoBody = await ssoRes.json().catch(() => ({}));
    if (!ssoRes.ok) {
      console.error("SSO register failed", ssoRes.status, ssoBody);
      return json({ error: ssoBody?.error ?? `SSO register failed (${ssoRes.status})`, details: ssoBody }, 500);
    }

    const sso_provider_id = ssoBody?.id ?? ssoBody?.provider?.id ?? null;

    // Upsert organization_sso row (manual, no unique constraint required)
    await admin.from("organization_sso")
      .delete()
      .eq("organization_id", organization_id)
      .eq("email_domain", email_domain);

    const { data: row, error: upErr } = await admin
      .from("organization_sso")
      .insert({
        organization_id,
        provider: "saml",
        email_domain,
        sso_provider_id,
        default_role,
        role_mappings,
        is_active: true,
      })
      .select()
      .single();

    if (upErr) {
      console.error("organization_sso upsert error", upErr);
      return json({ error: upErr.message }, 500);
    }

    await admin.from("audit_logs").insert({
      organization_id,
      actor_user_id: user.id,
      actor_email: user.email,
      action: "sso.saml_registered",
      resource_type: "organization_sso",
      resource_id: row.id,
      metadata: { email_domain, sso_provider_id },
    });

    return json({ ok: true, sso_provider_id, organization_sso: row });
  } catch (e) {
    console.error("org-sso-register error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
