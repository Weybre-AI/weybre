import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Set environment variables BEFORE importing auth.ts
Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");

import { requireEnv, getUser } from "./auth.ts";

Deno.test("auth - requireEnv returns value if set", () => {
  Deno.env.set("TEST_VAR", "123");
  assertEquals(requireEnv("TEST_VAR"), "123");
});

Deno.test("auth - requireEnv throws if not set", () => {
  assertRejects(
    async () => {
      requireEnv("NON_EXISTENT_VAR");
    },
    Error,
    "Missing environment variable: NON_EXISTENT_VAR"
  );
});

Deno.test("auth - getUser returns null if no auth header", async () => {
  const user = await getUser(null);
  assertEquals(user, null);
});

Deno.test("auth - getUser returns null if empty auth header", async () => {
  const user = await getUser("");
  assertEquals(user, null);
});

Deno.test("auth - getUser returns null if only 'Bearer '", async () => {
  const user = await getUser("Bearer ");
  assertEquals(user, null);
});

Deno.test("auth - getUser calls fetch and returns user on success", async () => {
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    assertEquals(url, "https://test.supabase.co/auth/v1/user");
    assertEquals((init?.headers as Record<string, string>)?.Authorization, "Bearer valid-token");
    assertEquals((init?.headers as Record<string, string>)?.apikey, "test-service-key");
    
    return new Response(JSON.stringify({ id: "user123", email: "test@example.com" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const user = await getUser("Bearer valid-token");
    assertEquals(user?.id, "user123");
    assertEquals(user?.email, "test@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("auth - getUser returns null on fetch failure", async () => {
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = async () => {
    return new Response("Unauthorized", { status: 401 });
  };

  try {
    const user = await getUser("Bearer invalid-token");
    assertEquals(user, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
