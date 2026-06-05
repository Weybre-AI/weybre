import { wrapHandler } from "../_shared/response.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { deductCredits } from "../_shared/credits.ts";
import { logError } from "../_shared/logger.ts";
import { createJob } from "../_shared/jobs.ts";

const RequestSchema = z.object({
  contractId: z.string().uuid("Invalid contract ID"),
});

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

import { chatCompletion, MODELS } from "../_shared/ai.ts";

/**
 * Enterprise Contract Intake - Ingestion Endpoint
 * Creates a processing job and triggers the background worker.
 */
Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = RequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0]?.message ?? "Invalid request body" }, 400, origin);
    }
    const { contractId } = parseResult.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Initial validation & Credit Check
    const { data: contract } = await admin.from("contracts").select("id, status, file_name, extracted_text").eq("id", contractId).single();
    if (!contract) return json({ error: "Contract not found" }, 404, origin);

    const creditCheck = await deductCredits(admin, user.id, "contract_analysis", { contract_id: contractId });
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }

    // 1.1 Paralegal Triage (Initiative from weybre-skil)
    // Perform a fast-pass triage to give the user immediate feedback
    const triageRes: any = await chatCompletion(GOOGLE_AI_API_KEY, {
      model: MODELS.FLASH_LITE,
      messages: [
        { role: "system", content: "You are the Paralegal Triage agent at Weybre AI law firm. Perform a quick scan of this document. Identify: Type, Parties, Jurisdiction, and 3-5 Key Issues. Return JSON." },
        { role: "user", content: `Filename: ${contract.file_name}\n\nContent Preview: ${String(contract.extracted_text || "").slice(0, 5000)}` }
      ],
      response_format: { type: "json_object" }
    });
    const caseBrief = JSON.parse(triageRes.choices?.[0]?.message?.content ?? "{}");

    // 2. Create Job in dedicated tracking table with triage metadata
    const jobId = await createJob(admin, user.id, contractId, 'contract_intake', { caseBrief });

    // 3. Hand off to worker
    const workerUrl = `${SUPABASE_URL}/functions/v1/document-worker`;
    fetch(workerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE}`
      },
      body: JSON.stringify({ jobId })
    }).catch(err => logError("Worker trigger failed", err, { jobId }));

    // 4. Return immediately with Job ID and Case Brief for real-time tracking
    return json({ 
      status: "queued", 
      jobId, 
      caseBrief,
      credits_remaining: creditCheck.remaining 
    }, 202, origin);

  } catch (e) {
    logError("contract-intake ingestion error", e);
    return json({ error: "Job creation failed" }, 500, origin);
  }
}));
