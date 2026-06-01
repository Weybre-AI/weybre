/**
 * Shared CORS helper for Supabase edge functions.
 * Only allows requests from known app origins — never wildcard.
 */

const BASE_ALLOWED_ORIGINS = [
  "https://weybre.com",
  "https://www.weybre.com",
  "https://launchpad-momentum-boost.lovable.app",
  "https://id-preview--7f0b347e-d0d5-4f1c-a925-0908a1587e4f.lovable.app",
  // Local development — all variants the browser might send
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

function getAllowedOrigins(): Set<string> {
  const origins = new Set(BASE_ALLOWED_ORIGINS);
  const extra = Deno.env.get("CORS_EXTRA_ORIGINS");
  if (extra) {
    for (const o of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      origins.add(o);
    }
  }
  return origins;
}

export function isOriginAllowed(origin: string): boolean {
  return origin.length > 0 && getAllowedOrigins().has(origin);
}

const COMMON_HEADERS =
  "authorization, x-client-info, apikey, content-type, " +
  "x-supabase-client-platform, x-supabase-client-platform-version, " +
  "x-supabase-client-runtime, x-supabase-client-runtime-version";

export function corsHeaders(origin: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": COMMON_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
  // Echo the request origin only when it is explicitly allowed (required for browser CORS).
  if (isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function handleOptions(origin: string): Response {
  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export function json(
  body: unknown,
  status = 200,
  origin = "",
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}
