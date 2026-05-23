/**
 * Standardized response helpers for edge functions.
 * Ensures consistent CORS, error handling, and logging.
 */

import { corsHeaders } from "./cors.ts";

export interface StandardResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
  request_id?: string;
  credits_remaining?: number;
}

/**
 * Create a standardized JSON response with proper CORS headers.
 */
export function jsonResponse<T>(
  body: StandardResponse<T> | unknown,
  status = 200,
  origin = ""
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/**
 * Create a success response.
 */
export function successResponse<T>(
  data: T,
  origin = "",
  extra?: { credits_remaining?: number; request_id?: string }
): Response {
  return jsonResponse({ data, ...extra }, 200, origin);
}

/**
 * Create an error response with proper status code.
 */
export function errorResponse(
  error: string,
  status = 500,
  origin = "",
  extra?: { code?: string; request_id?: string }
): Response {
  return jsonResponse({ error, ...extra }, status, origin);
}

/**
 * Wrap edge function handler with standard error handling and logging.
 */
export function wrapHandler(
  handler: (req: Request, origin: string, requestId: string) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin") ?? "";
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const response = await handler(req, origin, requestId);
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] Request completed in ${duration}ms`);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] Request failed after ${duration}ms:`, error);
      return errorResponse(
        error instanceof Error ? error.message : "Internal server error",
        500,
        origin,
        { request_id: requestId }
      );
    }
  };
}

/**
 * Create a timeout promise that rejects after the specified duration.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = "Request timeout"
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}
