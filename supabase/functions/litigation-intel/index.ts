import { wrapHandler } from "../_shared/response.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { deductCredits } from "../_shared/credits.ts";
import { logError } from "../_shared/logger.ts";
import { createJob } from "../_shared/jobs.ts";

const RequestSchema = z.object({
  mode: z.enum(["auto", "cnr", "keyword", "document"]).default("auto"),
  cnr: z.string().optional().default(""),
  query: z.string().optional().default(""),
  documentText: z.string().optional().default(""),
});

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Enterprise Litigation Intelligence - Ingestion Endpoint
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
    const data = parseResult.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Credit Check (litigation brief costs 2 credits)
    const creditCheck = await deductCredits(admin, user.id, "litigation_brief", { 
      mode: data.mode, 
      cnr: data.cnr, 
      query: data.query?.slice(0, 200) 
    });
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }

    // 2. Create Job
    // Since litigation intel doesn't always have a single resource_id (like a contract),
    // we use the user.id as the resource anchor and store the parameters in metadata.
    const jobId = await createJob(admin, user.id, user.id, 'litigation_intel', { params: data });

    // 3. Trigger Worker
    const workerUrl = `${SUPABASE_URL}/functions/v1/document-worker`;
    fetch(workerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE}`
      },
      body: JSON.stringify({ jobId })
    }).catch(err => logError("Worker trigger failed", err, { jobId }));

    return json({ 
      status: "queued", 
      jobId, 
      credits_remaining: creditCheck.remaining 
    }, 202, origin);

  } catch (e) {
    logError("litigation-intel ingestion error", e);
    return json({ error: "Job creation failed" }, 500, origin);
  }
}));
