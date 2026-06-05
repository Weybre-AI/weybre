import { wrapHandler } from "../_shared/response.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { logError } from "../_shared/logger.ts";
import { json } from "../_shared/cors.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Secure SHA-256 hashing for API keys
 */
async function hashKey(key: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Manage Platform API Keys (Secure generation and hashing)
 */
Deno.serve(wrapHandler(async (req, origin, requestId) => {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // 1. Create API Key
    if (action === 'create') {
      const { name, scopes } = body;
      if (!name) return json({ error: "Name required" }, 400, origin);

      // Verify org membership
      const { data: member } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!member) return json({ error: "User must belong to an organization" }, 403, origin);

      const rawKey = `wyb_${crypto.randomUUID().replace(/-/g, '')}`;
      const hashed = await hashKey(rawKey);
      const prefix = rawKey.substring(0, 8);

      const { error } = await admin.from("api_keys").insert({
        organization_id: member.organization_id,
        user_id: user.id,
        name,
        key_hash: hashed,
        key_prefix: prefix,
        scopes: scopes || ['research:read']
      });

      if (error) throw error;

      return json({ key: rawKey }, 200, origin);
    }

    // 2. Revoke API Key
    if (action === 'revoke') {
      const { id } = body;
      if (!id) return json({ error: "ID required" }, 400, origin);

      const { error } = await admin
        .from("api_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id); // Ensure ownership

      if (error) throw error;
      return json({ success: true }, 200, origin);
    }

    return json({ error: "Invalid action" }, 400, origin);

  } catch (e) {
    logError("manage-api-keys error", e);
    return json({ error: e instanceof Error ? e.message : "Operation failed" }, 500, origin);
  }
}));
