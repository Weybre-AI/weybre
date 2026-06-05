import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * SHA-256 hashing for API keys
 */
async function hashKey(key: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify the Authorization header and return the authenticated user.
 * Supports:
 * 1. Supabase JWT (standard Bearer token)
 * 2. Weybre Platform API Key (wyb_...)
 */
export async function getUser(authHeader: string | null): Promise<{ id: string; email?: string; org_id?: string; [key: string]: unknown } | null> {
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!token) return null;

  // Path A: Weybre Platform API Key
  if (token.startsWith("wyb_")) {
    try {
      const hashed = await hashKey(token);
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data, error } = await admin
        .from("api_keys")
        .select("user_id, organization_id, scopes")
        .eq("key_hash", hashed)
        .single();
      
      if (error || !data) return null;

      // Log usage
      await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hashed);

      return { 
        id: data.user_id, 
        org_id: data.organization_id, 
        is_api_key: true,
        scopes: data.scopes 
      };
    } catch {
      return null;
    }
  }

  // Path B: Supabase Auth JWT
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SERVICE_ROLE,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}
