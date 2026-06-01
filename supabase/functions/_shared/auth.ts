/**
 * Shared auth helper for Supabase edge functions.
 * Uses the service role key to validate user JWTs — works with all Supabase key formats.
 */

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Verify the Authorization header and return the authenticated user.
 * Calls the Supabase Auth admin endpoint directly — no SDK needed.
 */
export async function getUser(authHeader: string | null): Promise<{ id: string; email?: string; [key: string]: unknown } | null> {
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!token) return null;

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
