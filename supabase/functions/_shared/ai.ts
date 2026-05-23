/**
 * Shared Google AI (Gemini) client for Supabase edge functions.
 *
 * Uses the Google AI Studio API — OpenAI-compatible endpoint.
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/openai/
 * Auth:     GOOGLE_AI_API_KEY (get from https://aistudio.google.com/apikey)
 *
 * Model names (no prefix needed):
 *   gemini-2.5-flash       — fast, high quality, default for most tasks
 *   gemini-2.5-flash-lite  — fastest, lowest cost, simple tasks
 *   gemini-2.5-pro         — highest quality, complex reasoning / multimodal
 *   text-embedding-004     — 768-dim embeddings (we pad to 1536 for schema compat)
 */

const GOOGLE_AI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

export const MODELS = {
  FLASH:      "gemini-2.5-flash",
  FLASH_LITE: "gemini-2.5-flash-lite",
  PRO:        "gemini-2.5-pro",
  EMBED:      "text-embedding-004",
} as const;

export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: any };

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  tools?: any[];
  tool_choice?: any;
  response_format?: { type: string };
  temperature?: number;
  max_tokens?: number;
}

/**
 * Call the Gemini chat completions endpoint.
 * Returns the raw response JSON — callers read choices[0].message.content.
 */
export async function chatCompletion(apiKey: string, opts: ChatOptions): Promise<any> {
  const res = await fetch(`${GOOGLE_AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? MODELS.FLASH,
      messages: opts.messages,
      ...(opts.tools        ? { tools: opts.tools }               : {}),
      ...(opts.tool_choice  ? { tool_choice: opts.tool_choice }   : {}),
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.max_tokens   ? { max_tokens: opts.max_tokens }     : {}),
    }),
  });

  if (res.status === 429) throw Object.assign(new Error("Rate limit reached. Please retry in a moment."), { status: 429 });
  if (res.status === 402) throw Object.assign(new Error("AI quota exhausted. Check your Google AI Studio usage."), { status: 402 });
  if (!res.ok) {
    const body = await res.text();
    console.error("Google AI error", res.status, body.slice(0, 500));
    throw Object.assign(new Error(`Google AI error ${res.status}`), { status: res.status });
  }

  return res.json();
}

/**
 * Generate a text embedding using text-embedding-004.
 * Returns a 1536-length vector (padded/truncated for schema compatibility).
 */
export async function embed(apiKey: string, text: string): Promise<number[] | null> {
  const res = await fetch(`${GOOGLE_AI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.EMBED,
      input: text.slice(0, 7500),
    }),
  });

  if (!res.ok) {
    console.error("embed error", res.status, await res.text());
    return null;
  }

  const j = await res.json();
  const v: number[] = j.data?.[0]?.embedding ?? [];

  // text-embedding-004 returns 768 dims; pad to 1536 for schema compatibility
  if (v.length === 1536) return v;
  if (v.length > 1536)   return v.slice(0, 1536);
  return [...v, ...new Array(1536 - v.length).fill(0)];
}
