import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { redactPII } from "./pii.ts";

Deno.test("pii - redacts email addresses", () => {
  const input = "Contact us at test@example.com or admin@domain.co.in for help.";
  const expected = "Contact us at [EMAIL [REDACTED]] or [EMAIL [REDACTED]] for help.";
  assertEquals(redactPII(input), expected);
});

Deno.test("pii - redacts Indian phone numbers", () => {
  const input = "Call me at +919876543210 or 09876543210 or just 9876543210.";
  const expected = "Call me at [PHONE [REDACTED]] or [PHONE [REDACTED]] or just [PHONE [REDACTED]].";
  assertEquals(redactPII(input), expected);
});

Deno.test("pii - redacts Aadhar numbers", () => {
  const input = "My aadhar is 1234-5678-9012 and another is 1234 5678 9012.";
  const expected = "My aadhar is [AADHAR [REDACTED]] and another is [AADHAR [REDACTED]].";
  assertEquals(redactPII(input), expected);
});

Deno.test("pii - redacts PAN numbers", () => {
  const input = "My PAN is ABCDE1234F.";
  const expected = "My PAN is [PAN [REDACTED]].";
  assertEquals(redactPII(input), expected);
});

Deno.test("pii - handles empty or null input", () => {
  assertEquals(redactPII(""), "");
  // @ts-expect-error testing null
  assertEquals(redactPII(null), null);
});
