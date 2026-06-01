/**
 * Shared credit management utilities for edge functions.
 * All AI operations MUST deduct credits BEFORE processing.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface CreditCheckResult {
  allowed: boolean;
  remaining: number;
  error?: string;
}

/**
 * Check and deduct credits atomically BEFORE processing.
 * Returns the new balance or -1 if insufficient credits.
 */
export async function deductCredits(
  admin: SupabaseClient,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<CreditCheckResult> {
  try {
    const { data, error } = await admin.rpc("deduct_credits", {
      _user_id: userId,
      _action: action,
      _metadata: metadata,
    });

    if (error) {
      console.error("deduct_credits error:", error);
      const hint =
        error.code === "42501" || error.message?.includes("permission")
          ? "Credit system misconfigured (missing DB grants). Contact support."
          : "Failed to check credits. Try again or contact support.";
      return {
        allowed: false,
        remaining: 0,
        error: hint,
      };
    }

    const remaining = data as number;

    if (remaining === -1) {
      return {
        allowed: false,
        remaining: 0,
        error: "Insufficient credits. Please upgrade your plan or wait for monthly reset.",
      };
    }

    return {
      allowed: true,
      remaining,
    };
  } catch (e) {
    console.error("deductCredits exception:", e);
    return {
      allowed: false,
      remaining: 0,
      error: "Credit check failed",
    };
  }
}

/**
 * Get current credit balance for a user.
 */
export async function getCreditBalance(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  try {
    const { data, error } = await admin
      .from("subscriptions")
      .select("credits_remaining")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (error || !data) return 0;
    return data.credits_remaining ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Validate input size to prevent abuse.
 */
export function validateInputSize(
  input: string,
  maxLength: number = 50000
): { valid: boolean; error?: string } {
  if (!input || input.length === 0) {
    return { valid: false, error: "Input cannot be empty" };
  }
  if (input.length > maxLength) {
    return {
      valid: false,
      error: `Input too large. Maximum ${maxLength} characters allowed.`,
    };
  }
  return { valid: true };
}

/**
 * Rate limiting check (simple in-memory implementation).
 * For production, use Redis or Supabase Edge Functions rate limiting.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; error?: string } {
  const now = Date.now();
  const key = userId;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      error: `Rate limit exceeded. Maximum ${maxRequests} requests per minute.`,
    };
  }

  record.count++;
  return { allowed: true };
}
