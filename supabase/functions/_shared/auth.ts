/**
 * Shared auth helper for Supabase edge functions.
 * Uses the service role key to validate user JWTs — works with all Supabase key formats.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Verify the Authorization header and return the authenticated user.
 * Calls the Supabase Auth admin endpoint directly — no SDK needed.
 */
export async function getUser(authHeader: string | null): Promise<{ id: string; email?: string; [key: string]: any } | null> {
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
