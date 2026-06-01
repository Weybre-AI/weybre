// deploy: 20260523160000
// Multilingual OCR via Gemini vision
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { chatCompletion, MODELS } from "../_shared/ai.ts";
import { deductCredits, checkRateLimit } from "../_shared/credits.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_AI_API_KEY = requireEnv("GOOGLE_AI_API_KEY");

const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function normalizeImage(s: string): { mime: string; data: string } | null {
  if (!s) return null;
  const m = s.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/);
  if (m) return { mime: m[1], data: m[2] };
  return { mime: "image/png", data: s };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rateCheck = checkRateLimit(user.id, 15, 60000);
    if (!rateCheck.allowed) return json({ error: rateCheck.error }, 429, origin);

    const creditCheck = await deductCredits(admin, user.id, "vision_ocr", {});
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }

    const body = await req.json().catch(() => ({}));
    const images: string[] = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    const languageHint: string = String(body.languageHint ?? "auto");
    if (images.length === 0) return json({ error: "Provide at least one image (base64 or data URL)." }, 400, origin);

    const parts: unknown[] = [
      {
        type: "text",
        text:
          `You are a multilingual OCR engine for Indian legal documents. ` +
          `Extract ALL text verbatim. Handle Devanagari, Tamil, Bengali, and English. ` +
          `Return only extracted text. Language hint: ${languageHint}.`,
      },
    ];
    for (const img of images) {
      const norm = normalizeImage(img);
      if (!norm) continue;
      const approxBytes = Math.floor((norm.data.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        return json({ error: `Each image must be <= ${MAX_IMAGE_BYTES} bytes decoded` }, 413, origin);
      }
      parts.push({
        type: "image_url",
        image_url: { url: `data:${norm.mime};base64,${norm.data}` },
      });
    }

    let j: unknown;
    try {
      j = await chatCompletion(GOOGLE_AI_API_KEY, {
        model: MODELS.FLASH,
        messages: [{ role: "user", content: parts }],
      });
    } catch (aiErr: { message?: string; status?: number }) {
      return json({ error: aiErr.message ?? "Vision OCR failed" }, aiErr.status ?? 500, origin);
    }
    const parsed = j as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
    const text = parsed.choices?.[0]?.message?.content ?? "";

    return json({ text, pages: images.length, tokens: parsed.usage?.total_tokens ?? 0, credits_remaining: creditCheck.remaining }, 200, origin);
  } catch (e) {
    console.error("vision-ocr error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
});
