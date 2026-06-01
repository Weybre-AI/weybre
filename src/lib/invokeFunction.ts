import { supabase } from "@/integrations/supabase/client";
import type { FunctionInvokeOptions } from "@supabase/supabase-js";

/**
 * Invoke a Supabase Edge Function with retry logic for transient errors
 * and surface the JSON error body when the runtime returns a non-2xx status.
 */
export async function invokeFunction<T = Record<string, unknown>>(
  name: string,
  options?: FunctionInvokeOptions,
  maxRetries = 2
): Promise<{ data: T | null; error: Error | null }> {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      const { data, error } = await supabase.functions.invoke(name, options);

      if (!error) {
        if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
          return { data: null, error: new Error(String((data as { error: string }).error)) };
        }
        return { data: data as T, error: null };
      }

      let message = error.message ?? "Request failed";

      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body && typeof body === "object") {
            if (typeof (body as { error?: string }).error === "string") {
              message = (body as { error: string }).error;
            } else if (typeof (body as { message?: string }).message === "string") {
              message = (body as { message: string }).message;
            }
          }
        } catch {
          /* ignore parse errors */
        }
      }

      if (message.includes("non-2xx")) {
        if (message.includes("402") || message.toLowerCase().includes("credits")) {
          message = "Insufficient AI credits. Upgrade your plan or wait for your monthly reset.";
        } else if (message.includes("401")) {
          message = "Session expired. Please sign in again.";
        } else if (message.includes("429")) {
          message = "Too many requests. Please wait a moment and try again.";
        }
      }

      // Retry on network errors or 5xx, but not on 4xx client errors
      if (attempt < maxRetries && (!ctx || (ctx.status >= 500 && ctx.status < 600))) {
        attempt++;
        await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 500)); // 1s, 2s
        continue;
      }

      return { data: null, error: new Error(message) };
    } catch (e) {
      if (attempt < maxRetries) {
        attempt++;
        await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 500));
        continue;
      }
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }
  
  return { data: null, error: new Error("Max retries exceeded") };
}
