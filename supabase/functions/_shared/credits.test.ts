import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deductCredits, getCreditBalance, validateInputSize, checkRateLimit } from "./credits.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// --- Mocks ---

function createMockAdmin(rpcResponse: any, fromResponse: any): SupabaseClient {
  return {
    rpc: async () => rpcResponse,
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => fromResponse
          })
        })
      })
    })
  } as unknown as SupabaseClient;
}

// --- Tests: deductCredits ---

Deno.test("credits - deductCredits returns success when credits sufficient", async () => {
  const mockAdmin = createMockAdmin({ data: 99, error: null }, null);
  const result = await deductCredits(mockAdmin, "user123", "test_action");
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 99);
  assertEquals(result.error, undefined);
});

Deno.test("credits - deductCredits returns error when credits exhausted (-1)", async () => {
  const mockAdmin = createMockAdmin({ data: -1, error: null }, null);
  const result = await deductCredits(mockAdmin, "user123", "test_action");
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
  assertEquals(typeof result.error, "string");
});

Deno.test("credits - deductCredits returns error on RPC failure", async () => {
  const mockAdmin = createMockAdmin({ data: null, error: { message: "DB Error" } }, null);
  const result = await deductCredits(mockAdmin, "user123", "test_action");
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
});

// --- Tests: getCreditBalance ---

Deno.test("credits - getCreditBalance returns balance on success", async () => {
  const mockAdmin = createMockAdmin(null, { data: { credits_remaining: 50 }, error: null });
  const balance = await getCreditBalance(mockAdmin, "user123");
  assertEquals(balance, 50);
});

Deno.test("credits - getCreditBalance returns 0 on error", async () => {
  const mockAdmin = createMockAdmin(null, { data: null, error: { message: "Not found" } });
  const balance = await getCreditBalance(mockAdmin, "user123");
  assertEquals(balance, 0);
});

Deno.test("credits - getCreditBalance returns 0 if data is null", async () => {
  const mockAdmin = createMockAdmin(null, { data: null, error: null });
  const balance = await getCreditBalance(mockAdmin, "user123");
  assertEquals(balance, 0);
});

// --- Tests: validateInputSize ---

Deno.test("credits - validateInputSize fails on empty input", () => {
  const result = validateInputSize("");
  assertEquals(result.valid, false);
});

Deno.test("credits - validateInputSize fails on too large input", () => {
  const result = validateInputSize("a".repeat(101), 100);
  assertEquals(result.valid, false);
});

Deno.test("credits - validateInputSize succeeds on valid input", () => {
  const result = validateInputSize("valid input", 100);
  assertEquals(result.valid, true);
});

// --- Tests: checkRateLimit ---

Deno.test("credits - checkRateLimit allows requests under limit", () => {
  const userId = "test_user_rate_1";
  
  // First request
  let result = checkRateLimit(userId, 2, 60000);
  assertEquals(result.allowed, true);
  
  // Second request
  result = checkRateLimit(userId, 2, 60000);
  assertEquals(result.allowed, true);
  
  // Third request (exceeds limit)
  result = checkRateLimit(userId, 2, 60000);
  assertEquals(result.allowed, false);
  assertEquals(typeof result.error, "string");
});
