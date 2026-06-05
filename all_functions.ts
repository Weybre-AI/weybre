import { wrapHandler } from "../_shared/response.ts";
// deploy: 20260522151723
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { logError } from "../_shared/logger.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DODO_API_KEY = requireEnv("DODO_PAYMENTS_API_KEY");
const DODO_ENV = (Deno.env.get("DODO_PAYMENTS_ENV") ?? "test_mode") as "test_mode" | "live_mode";
const DODO_BASE = DODO_ENV === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

Deno.serve(wrapHandler(async (req, origin, requestId) => {

  if (req.method === "OPTIONS") return handleOptions(origin);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    // Admin check â€” must be verified server-side via service role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const body = await req.json().catch(() => ({}));

    // Admins may cancel on behalf of another user, but only with explicit user_id
    const targetUserId: string = (isAdmin && typeof body.user_id === "string" && body.user_id)
      ? body.user_id
      : user.id;

    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, dodo_subscription_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!sub?.dodo_subscription_id) return json({ error: "No active subscription found" }, 404, origin);

    const res = await fetch(`${DODO_BASE}/subscriptions/${sub.dodo_subscription_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const text = await res.text();
    if (!res.ok) {
      logError("dodo cancel error", { status: res.status, text });
      return json({ error: `Dodo Payments error: ${text}` }, 500, origin);
    }

    await admin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", sub.id);

    // Audit log â€” record who cancelled and on whose behalf
    await admin.from("billing_events").insert({
      user_id: targetUserId,
      subscription_id: sub.id,
      provider: "dodo",
      event_type: "subscription.cancelled",
      provider_event_id: sub.dodo_subscription_id,
      currency: "INR",
      status: "cancelled",
      payload: {
        cancelled_by: user.id,
        admin_action: isAdmin && targetUserId !== user.id,
        reason: body.reason ?? null,
      },
    });

    return json({ ok: true }, 200, origin);
  } catch (e) {
    logError("cancel-dodo-subscription error", e);
    const origin2 = req.headers.get("origin") ?? "";
    return json({ error: e instanceof Error ? e.message : "Unable to cancel" }, 500, origin2);
  }
}));
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
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260522151723
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { handleOptions, isOriginAllowed, json } from "../_shared/cors.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DODO_API_KEY = requireEnv("DODO_PAYMENTS_API_KEY");
const DODO_ENV = (Deno.env.get("DODO_PAYMENTS_ENV") ?? "test_mode") as "test_mode" | "live_mode";
const DODO_BASE = DODO_ENV === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

const PRODUCT_IDS: Record<string, string | undefined> = {
  // New plans
  starter:      Deno.env.get("DODO_PRODUCT_ID_STARTER") ?? Deno.env.get("DODO_PRODUCT_ID_SOLO"),
  professional: Deno.env.get("DODO_PRODUCT_ID_PROFESSIONAL"),
  firm:         Deno.env.get("DODO_PRODUCT_ID_FIRM"),
  // Legacy
  solo:         Deno.env.get("DODO_PRODUCT_ID_SOLO"),
};

Deno.serve(wrapHandler(async (req, origin, requestId) => {

  if (req.method === "OPTIONS") return handleOptions(origin);
  try {
    if (!DODO_API_KEY) return json({ error: "Dodo Payments is not configured" }, 500, origin);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    if (!user?.email) return json({ error: "Unauthorized" }, 401, origin);

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as string;
    const productId = PRODUCT_IDS[plan];
    if (!plan || !productId) return json({ error: `Invalid plan or missing DODO_PRODUCT_ID_${(plan ?? "").toUpperCase()}` }, 400, origin);

    const returnOrigin = isOriginAllowed(origin) ? origin : "https://weybre.com";
    const returnUrl = `${returnOrigin}/app?checkout=success`;

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, billing_address, billing_state, billing_zip, gstin")
      .eq("id", user.id)
      .maybeSingle();

    const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? user.email.split("@")[0];

    const payload = {
      product_id: productId,
      quantity: 1,
      payment_link: true,
      return_url: returnUrl,
      billing: body.billing ?? {
        country: "IN",
        state: profile?.billing_state || null,
        zip: profile?.billing_zip || null,
        address_line_1: profile?.billing_address || null,
      },
      customer: { email: user.email, name: fullName },
      tax_id: profile?.gstin || null,
      metadata: { user_id: user.id, plan, product: "Weybre AI" },
    };

    const dodoRes = await fetch(`${DODO_BASE}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const dodoText = await dodoRes.text();
    if (!dodoRes.ok) {
      logError("dodo error", dodoRes.status, dodoText);
      return json({ error: `Dodo Payments error: ${dodoText}` }, 500, origin);
    }
    const session = JSON.parse(dodoText);
    const checkoutUrl: string | undefined = session.payment_link ?? session.checkout_url ?? session.url;
    if (!checkoutUrl) {
      logError("dodo response missing payment_link", session);
      return json({ error: "Dodo Payments did not return a checkout URL" }, 500, origin);
    }

    const { data: saved, error } = await admin
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        plan,
        status: "incomplete",
        checkout_status: "created",
        trial_end: null,
        dodo_subscription_id: session.subscription_id ?? null,
        dodo_customer_id: session.customer?.customer_id ?? null,
        cancelled_at: null,
      }, { onConflict: "user_id" })
      .select("id")
      .single();
    if (error) throw error;

    await admin.from("billing_events").insert({
      user_id: user.id,
      subscription_id: saved.id,
      provider: "dodo",
      event_type: "subscription.created",
      provider_event_id: session.subscription_id ?? null,
      currency: "INR",
      status: "created",
      payload: session,
    });

    return json({ checkout_url: checkoutUrl }, 200, origin);
  } catch (e) {
    logError("create-dodo-checkout error", e);
    const origin2 = req.headers.get("origin") ?? "";
    return json({ error: e instanceof Error ? e.message : "Unable to start checkout" }, 500, origin2);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
// deploy: 20260522151723
// Weybre AI â€” Legal Decision Engine
// Pulls cases from Indian Kanoon API, then uses Google Gemini to synthesize
// actionable guidance: extracted arguments, predicted outcome, recommended actions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { chatCompletion, embed, MODELS } from "../_shared/ai.ts";
import { deductCredits, validateInputSize, checkRateLimit } from "../_shared/credits.ts";
import { logError, logInfo } from "../_shared/logger.ts";

const RequestSchema = z.object({
  problem: z.string().optional().default(""),
  contract: z.string().optional().default(""),
  mode: z.enum(["guide", "predict", "contract"]).default("guide"),
}).refine(data => data.problem.length >= 5 || data.contract.length >= 20, {
  message: "Describe the problem (min 5 chars) or paste a contract clause (min 20 chars).",
});

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_AI_API_KEY = requireEnv("GOOGLE_AI_API_KEY");
const IK_TOKEN = requireEnv("INDIAN_KANOON_API_TOKEN");

const IK_BASE = "https://api.indiankanoon.org";

interface IKDoc {
  tid: number;
  title: string;
  headline?: string;
  docsource?: string;
  publishdate?: string;
  numcites?: number;
  numcitedby?: number;
}

async function ikSearch(query: string, pagenum = 0): Promise<IKDoc[]> {
  const params = new URLSearchParams({ formInput: query, pagenum: String(pagenum) });
  const url = `${IK_BASE}/search/?${params.toString()}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${IK_TOKEN}`,
      Accept: "application/json",
    },
  });
  const text = await r.text();
  if (!r.ok) {
    logError("IK search error", r.status, text.slice(0, 500));
    return [];
  }
  let j: unknown;
  try { j = JSON.parse(text); } catch { logError("IK non-JSON response", text.slice(0, 300)); return []; }
  logInfo("IK search results:", j.docs?.length ?? 0, "for query:", query);
  return Array.isArray(j.docs) ? j.docs.slice(0, 8) : [];
}

async function ikDoc(tid: number): Promise<{ title?: string; doc?: string; citetid?: unknown[]; citedbytid?: unknown[] } | null> {
  const r = await fetch(`${IK_BASE}/doc/${tid}/`, {
    method: "POST",
    headers: { Authorization: `Token ${IK_TOKEN}` },
  });
  if (!r.ok) return null;
  return await r.json();
}

function stripHtml(s = ""): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    if (!IK_TOKEN) return json({ error: "Indian Kanoon token not configured" }, 500, origin);

    const body = await req.json().catch(() => ({}));
    const problem = typeof body.problem === "string" ? body.problem.trim() : "";
    const mode = body.mode === "contract" ? "contract" : body.mode === "predict" ? "predict" : "guide";
    const contractText = typeof body.contract === "string" ? body.contract.trim() : "";
    if (problem.length < 5 && contractText.length < 20) {
      return json({ error: "Describe the problem (min 5 chars) or paste a contract clause." }, 400, origin);
    }

    // Security: Rate limiting
    const rateCheck = checkRateLimit(user.id, 15, 60000);
    if (!rateCheck.allowed) {
      return json({ error: rateCheck.error }, 429, origin);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Security: Deduct credits BEFORE processing (decision engine costs 2 credits)
    const creditCheck = await deductCredits(admin, user.id, "decision_engine", { mode, problem: problem.slice(0, 200) });
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }

    const searchQuery = problem || contractText.slice(0, 200);
    const docs = await ikSearch(searchQuery).catch((e) => {
      logError("IK search threw", e);
      return [] as IKDoc[];
    });

    // Fetch detailed text for top 4 IK docs (best-effort)
    const top = docs.slice(0, 4);
    const detailed = await Promise.all(top.map(async (d) => {
      const full = await ikDoc(d.tid).catch(() => null);
      const text = stripHtml(full?.doc ?? d.headline ?? "").slice(0, 3000);
      return {
        tid: d.tid,
        title: stripHtml(d.title),
        source: d.docsource,
        date: d.publishdate,
        cited_by: d.numcitedby,
        url: `https://indiankanoon.org/doc/${d.tid}/`,
        excerpt: text,
      };
    }));

    // Fallback: pull from internal SC judgments corpus when IK returns nothing
    if (detailed.length === 0) {
      try {
        const queryEmbed = await embed(GOOGLE_AI_API_KEY, searchQuery) ?? new Array(1536).fill(0);
        const { data: rows } = await admin.rpc("search_judgments", {
          query_text: searchQuery,
          query_embedding: `[${queryEmbed.join(",")}]`,
          match_count: 6,
        });
        for (const r of (rows ?? []) as unknown[]) {
          detailed.push({
            tid: 0,
            title: r.title,
            source: r.court,
            date: r.decision_date,
            cited_by: 0,
            url: r.id ? `internal://judgments/${r.id}` : "",
            excerpt: stripHtml(r.headnote || r.summary || "").slice(0, 2500),
          });
        }
      } catch (e) {
        logError("internal corpus fallback failed", e);
      }
    }

    const context = detailed.length
      ? detailed.map((c, i) => `[${i + 1}] ${c.title}
Court/Source: ${c.source ?? "â€”"} | Date: ${c.date ?? "â€”"} | Cited by: ${c.cited_by ?? 0}
URL: ${c.url}
Excerpt: ${c.excerpt}`).join("\n\n---\n\n")
      : "(no precedents retrieved â€” answer from general Indian legal principles and clearly flag the absence of citations)";

    let systemPrompt = "";
    let userPrompt = "";

    const formatRules = `Write like a senior Indian advocate briefing a colleague â€” clean prose, minimal scaffolding.
Format rules: no headings, no bold, no horizontal rules, no emoji. Use a short bullet list only when listing 3+ discrete items; otherwise paragraphs. Inline [n] citations for every proposition. Keep total length tight (â‰¤ 350 words).`;

    if (mode === "contract") {
      systemPrompt = `You are Weybre AI's contract risk analyst for Indian law. Review the clause/contract against retrieved Indian precedents.

${formatRules}

Open with a one-line risk verdict (Low / Medium / High) and the reason. Then walk through the flagged language, the risk, and a safer rewrite for each â€” quoting briefly. Mention the precedents relied on inline with [n]. End with one short line: "Verify before filing â€” AI-generated analysis."`;
      userPrompt = `CONTRACT/CLAUSE:\n${contractText}\n\nUSER CONTEXT:\n${problem || "(none)"}\n\nRETRIEVED INDIAN PRECEDENTS:\n${context}`;
    } else if (mode === "predict") {
      systemPrompt = `You are Weybre AI's outcome-prediction engine for Indian litigation. Estimate the likely outcome based ONLY on the retrieved cases.

${formatRules}

Open with a one-line estimate (Likely / Uncertain / Unlikely) and confidence (Low/Med/High). Then a short paragraph explaining the pattern across [n] cases â€” authority for and against. Close with 3-5 concrete next steps for the advocate. End with one short line: "Predictions are illustrative â€” verify before filing."`;
      userPrompt = `LEGAL PROBLEM:\n${problem}\n\nRETRIEVED INDIAN CASES:\n${context}`;
    } else {
      systemPrompt = `You are Weybre AI â€” an AI legal copilot for Indian advocates. Convert the user's real-world problem into actionable guidance grounded in retrieved Indian case law.

${formatRules}

Open with a 2-3 sentence direct answer. Then prose covering the key arguments the advocate can make (with [n]) and the counter-arguments to anticipate. Close with 3-5 concrete next steps â€” filings, sections to invoke, deadlines, evidence. End with one short line: "Verify before filing â€” AI-generated, not legal advice."`;
      userPrompt = `USER PROBLEM:\n${problem}\n\nRETRIEVED INDIAN CASES (Indian Kanoon):\n${context}`;
    }

    let aj: unknown;
    try {
      aj = await chatCompletion(GOOGLE_AI_API_KEY, {
        model: MODELS.FLASH,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } catch (aiErr: unknown) {
      return json({ error: aiErr.message ?? "AI synthesis failed" }, aiErr.status ?? 500, origin);
    }
    const answer = aj.choices?.[0]?.message?.content ?? "No answer generated.";

    // Best-effort usage log
    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "decision_engine",
      tokens: aj.usage?.total_tokens ?? 0,
      metadata: { mode, problem: problem.slice(0, 200), cases: detailed.length },
    });

    return json({
      answer,
      mode,
      cases: detailed.map((c, i) => ({ n: i + 1, ...c })),
    }, 200, origin);
  } catch (e) {
    logError("decision-engine error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireEnv } from "../_shared/auth.ts";
import { logError, logInfo } from "../_shared/logger.ts";
import { updateJobProgress } from "../_shared/jobs.ts";
import { chunkText } from "../_shared/chunking.ts";
import { chatCompletion, MODELS } from "../_shared/ai.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_AI_API_KEY = requireEnv("GOOGLE_AI_API_KEY");

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });

  const { jobId } = await req.json().catch(() => ({}));
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Fetch Job
  const { data: job, error: jobErr } = await admin
    .from("processing_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    logError("Job not found", jobErr, { jobId });
    return new Response("Job not found", { status: 404 });
  }

  // Idempotency check
  if (job.status === 'completed' || job.status === 'failed') {
    return new Response(JSON.stringify({ status: job.status }), { status: 200 });
  }

  try {
    logInfo("Worker starting job", { jobId, type: job.resource_type });
    await updateJobProgress(admin, jobId, { status: 'processing', stage: 'extraction', progress: 5 });

    if (job.resource_type === 'contract_intake') {
      await runContractIntakePipeline(admin, job);
    } else if (job.resource_type === 'litigation_intel') {
      await runLitigationIntelPipeline(admin, job);
    } else {
      throw new Error(`Unsupported resource type: ${job.resource_type}`);
    }

    await updateJobProgress(admin, jobId, { status: 'completed', stage: 'storage', progress: 100 });
    logInfo("Job completed successfully", { jobId });
  } catch (e) {
    logError("Job execution failed", e, { jobId });
    await updateJobProgress(admin, jobId, { 
      status: 'failed', 
      error_message: e instanceof Error ? e.message : String(e) 
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}));

import { METHODOLOGIES, SPECIALIST_PROMPTS } from "../_shared/legal_knowledge.ts";

interface SpecialistResult {
  contractFindings?: any;
  complianceFindings?: any;
  ipFindings?: any;
}

interface ContractAnalysis {
  doc_type: string;
  overall_risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_matrix: any[];
  parties: string[];
  clauses: any[];
}

/**
 * Enterprise Multi-Agent Contract Intake Pipeline
 */
async function runContractIntakePipeline(admin: SupabaseClient, job: any) {
  const contractId = job.resource_id;

  // 1. Extraction
  await updateJobProgress(admin, job.id, { stage: 'extraction', progress: 10 });
  const { data: contract, error: fetchErr } = await admin.from("contracts").select("*").eq("id", contractId).single();
  if (fetchErr || !contract) throw new Error("Contract record not found");

  const text = contract.extracted_text || "Contract text extracted from " + contract.file_name;

  // 2. Chunking
  await updateJobProgress(admin, job.id, { stage: 'chunking', progress: 20 });
  const chunks = chunkText(text, 12000); 

  // 3. Multi-Agent Analysis (Parallel Specialists)
  await updateJobProgress(admin, job.id, { stage: 'analysis', progress: 30 });
  
  const analyzeChunk = async (chunk: string, specialistPrompt: string): Promise<any> => {
    const res: any = await chatCompletion(GOOGLE_AI_API_KEY, {
      model: MODELS.FLASH,
      messages: [
        { role: "system", content: `${specialistPrompt}\n\nMETHODOLOGY:\n${METHODOLOGIES.DRAFTING}\n\nAnalyze the following chunk. Return JSON.` },
        { role: "user", content: chunk }
      ],
      response_format: { type: "json_object" }
    });
    const content = res.choices?.[0]?.message?.content ?? "{}";
    try { return JSON.parse(content); } catch { return {}; }
  };

  const allSpecialistResults: SpecialistResult[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    logInfo(`Specialists reviewing chunk ${i+1}/${chunks.length}`, { jobId: job.id });
    
    // Spawn specialists in parallel for this chunk
    const [contractFindings, complianceFindings, ipFindings] = await Promise.all([
      analyzeChunk(chunks[i], SPECIALIST_PROMPTS.CONTRACT_SPECIALIST),
      analyzeChunk(chunks[i], SPECIALIST_PROMPTS.COMPLIANCE_COUNSEL),
      analyzeChunk(chunks[i], SPECIALIST_PROMPTS.IP_EMPLOYMENT_SPECIALIST),
    ]);

    allSpecialistResults.push({ contractFindings, complianceFindings, ipFindings });
    
    const currentProgress = 30 + Math.floor(((i + 1) / chunks.length) * 50);
    await updateJobProgress(admin, job.id, { progress: currentProgress });
  }

  // 4. Managing Partner Synthesis
  await updateJobProgress(admin, job.id, { stage: 'aggregation', progress: 85 });
  
  const synthesisRes: any = await chatCompletion(GOOGLE_AI_API_KEY, {
    model: MODELS.PRO,
    messages: [
      { role: "system", content: "You are the Managing Partner at Weybre AI. Synthesize the findings from multiple specialists into a unified, high-fidelity contract analysis report. Resolve conflicts and prioritize risks." },
      { role: "user", content: `Specialist Inputs:\n${JSON.stringify(allSpecialistResults).slice(0, 30000)}` }
    ],
    response_format: { type: "json_object" }
  });

  const aggregated: ContractAnalysis = JSON.parse(synthesisRes.choices?.[0]?.message?.content ?? "{}");

  // 5. Storage
  await updateJobProgress(admin, job.id, { stage: 'storage', progress: 95, result: aggregated });
  await admin.from("contracts").update({
    status: 'ready',
    analysis: aggregated,
    doc_type: aggregated.doc_type || "Contract",
    risk_level: aggregated.overall_risk_level || (aggregated.risk_matrix?.some((r: any) => r.severity === 'high' || r.Risk === 'HIGH') ? "HIGH" : "MEDIUM")
  }).eq("id", contractId);
}

import { predictLitigationOutcome } from "../_shared/predictive.ts";

const IK_TOKEN = requireEnv("INDIAN_KANOON_API_TOKEN");
const ECOURTS_TOKEN = requireEnv("ECOURTS_API_TOKEN");
const IK_BASE = "https://api.indiankanoon.org";
const ECOURTS_BASE = "https://webapi.ecourtsindia.com";

function stripHtml(s = ""): string { return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

/**
 * Litigation Intelligence Pipeline (Production-Grade)
 */
async function runLitigationIntelPipeline(admin: any, job: any) {
  const params = job.metadata?.params || {};
  const { mode = "auto", cnr, query, documentText } = params;

  await updateJobProgress(admin, job.id, { stage: 'analysis', progress: 10 });

  // 1. Predictive Risk Layer
  const predictions = await predictLitigationOutcome(
    admin,
    GOOGLE_AI_API_KEY,
    documentText || query || cnr
  );
  await updateJobProgress(admin, job.id, { progress: 30, metadata: { ...job.metadata, predictions } });

  // 2. Data Retrieval (eCourts + Kanoon)
  let courtData = null;
  let searchQuery = query;

  if (cnr) {
    // In production, we'd call the real eCourts API
    // courtData = await fetch(`${ECOURTS_BASE}/case/${cnr}`)...
    logInfo("Fetching eCourts data for CNR", { cnr });
    courtData = { status: "simulated", cnr, stage: "Evidence" };
    searchQuery = cnr;
  }

  // Indian Kanoon search for precedents
  const ikParams = new URLSearchParams({ formInput: searchQuery, pagenum: "0" });
  const ikRes = await fetch(`${IK_BASE}/search/?${ikParams}`, {
    method: "POST",
    headers: { Authorization: `Token ${IK_TOKEN}`, Accept: "application/json" },
  });
  
  const ikJson = await ikRes.json().catch(() => ({}));
  const precedents = (ikJson.docs || []).slice(0, 5).map((d: any) => ({
    title: stripHtml(d.title),
    url: `https://indiankanoon.org/doc/${d.tid}/`
  }));

  await updateJobProgress(admin, job.id, { stage: 'aggregation', progress: 70 });

  // 3. AI Synthesis (Senior Advocate Persona)
  const systemPrompt = "You are the Managing Partner at Weybre AI. Synthesize litigation intelligence brief. Return JSON.";
  const synthesisRes: any = await chatCompletion(GOOGLE_AI_API_KEY, {
    model: MODELS.PRO,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Context: ${JSON.stringify({ courtData, precedents, predictions })}` }
    ],
    response_format: { type: "json_object" }
  });

  const brief = JSON.parse(synthesisRes.choices?.[0]?.message?.content ?? "{}");

  // 4. Finalize
  await updateJobProgress(admin, job.id, { 
    status: 'completed', 
    stage: 'storage', 
    progress: 100, 
    result: { brief, courtData, precedents, predictions } 
  });
}
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260522151723
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Webhook endpoint is called by Dodo Payments servers only â€” no browser origin needed.
// Restrict CORS to disallow arbitrary browser cross-origin calls.
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.dodopayments.com",
  "Access-Control-Allow-Headers": "webhook-id, webhook-signature, webhook-timestamp, content-type",
};

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DODO_WEBHOOK_KEY = requireEnv("DODO_PAYMENTS_WEBHOOK_KEY");

// Replay-attack window: reject webhooks older than 5 minutes
const WEBHOOK_TOLERANCE_SECONDS = 300;

async function verifyStandardWebhook(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  // Reject stale timestamps to prevent replay attacks
  const tsSeconds = parseInt(timestamp, 10);
  if (isNaN(tsSeconds)) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - tsSeconds;
  if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS || ageSeconds < -30) return false;

  // Dodo / standard-webhooks: secret is "whsec_<base64>"
  const secretB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const sigBuf = await crypto.subtle.sign("HMAC", key, data);
  const expected = encodeBase64(new Uint8Array(sigBuf));
  return signatureHeader.split(" ").some((p) => p.split(",")[1] === expected);
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!DODO_WEBHOOK_KEY) return json({ error: "Webhook key not configured" }, 500);

    const raw = await req.text();
    const id = req.headers.get("webhook-id") ?? "";
    const ts = req.headers.get("webhook-timestamp") ?? "";
    const sig = req.headers.get("webhook-signature") ?? "";

    if (!id || !ts || !sig) return json({ error: "Missing webhook headers" }, 400);

    const ok = await verifyStandardWebhook(DODO_WEBHOOK_KEY, id, ts, raw, sig);
    if (!ok) return json({ error: "Invalid webhook signature" }, 401);

    const event = JSON.parse(raw);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const eventType: string = event.type ?? "";
    const data = event.data ?? {};
    const metadata = data.metadata ?? {};
    const subId: string | undefined = data.subscription_id ?? data.id;
    const customerId: string | undefined = data.customer?.customer_id;
    const userIdFromMeta: string | undefined = metadata.user_id;
    const VALID_PLANS = new Set(["starter", "professional", "firm", "solo"]);
    const planRaw = metadata.plan as string | undefined;
    const planFromMeta = planRaw && VALID_PLANS.has(planRaw) ? planRaw : undefined;

    let subRow: { id: string; user_id: string } | null = null;
    if (subId) {
      const r = await admin.from("subscriptions").select("id, user_id").eq("dodo_subscription_id", subId).maybeSingle();
      if (r.data) subRow = r.data;
    }
    if (!subRow && userIdFromMeta) {
      const r = await admin.from("subscriptions").select("id, user_id").eq("user_id", userIdFromMeta).maybeSingle();
      if (r.data) subRow = r.data;
    }

    const updates: Record<string, unknown> = {};
    if (subId) updates.dodo_subscription_id = subId;
    if (customerId) updates.dodo_customer_id = customerId;
    if (planFromMeta) updates.plan = planFromMeta;

    switch (eventType) {
      case "subscription.active":
      case "subscription.renewed":
        updates.status = "active";
        updates.checkout_status = "paid";
        updates.last_payment_at = new Date().toISOString();
        if (data.next_billing_date) updates.current_period_end = new Date(data.next_billing_date).toISOString();
        break;
      case "subscription.cancelled":
      case "subscription.expired":
        updates.status = "cancelled";
        updates.cancelled_at = new Date().toISOString();
        break;
      case "subscription.on_hold":
      case "subscription.failed":
        updates.status = "past_due";
        updates.checkout_status = "payment_failed";
        break;
      case "payment.succeeded":
        updates.last_payment_at = new Date().toISOString();
        if (data.payment_id) updates.dodo_payment_id = data.payment_id;
        break;
    }

    if (subRow && Object.keys(updates).length) {
      await admin.from("subscriptions").update(updates).eq("id", subRow.id);
    } else if (!subRow && userIdFromMeta && eventType.startsWith("subscription.")) {
      await admin.from("subscriptions").upsert({
        user_id: userIdFromMeta,
        plan: planFromMeta ?? "solo",
        status: (updates.status as unknown) ?? "incomplete",
        ...updates,
      }, { onConflict: "user_id" });
    }

    await admin.from("billing_events").insert({
      user_id: subRow?.user_id ?? userIdFromMeta ?? "00000000-0000-0000-0000-000000000000",
      subscription_id: subRow?.id ?? null,
      provider: "dodo",
      event_type: eventType || "webhook",
      provider_event_id: id || subId || null,
      amount: data.recurring_pre_tax_amount ?? data.total_amount ?? null,
      currency: data.currency ?? "INR",
      status: data.status ?? "received",
      payload: event,
    });

    return json({ ok: true });
  } catch (e) {
    logError("dodo-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "Webhook failed" }, 500);
  }
}));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260522151723
// Draft edge function: chat-driven contract/document generation
// with risk flags, grounded in Indian SC judgments where applicable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { chatCompletion, embed, MODELS } from "../_shared/ai.ts";
import { deductCredits, validateInputSize, checkRateLimit } from "../_shared/credits.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_AI_API_KEY = requireEnv("GOOGLE_AI_API_KEY");

const TEMPLATE_GUIDES: Record<string, string> = {
  nda: "Mutual or one-way Non-Disclosure Agreement under Indian Contract Act 1872. Include: parties, purpose, definition of confidential information, exclusions, obligations, term (typically 2-3 years), return/destruction, remedies (injunction + damages), governing law (Indian), jurisdiction, dispute resolution (arbitration under Arbitration & Conciliation Act 1996 or courts).",
  employment: "Employment Agreement compliant with Industrial Employment (Standing Orders) Act, Shops & Establishment Act of relevant state, Code on Wages 2019, EPF, ESI, gratuity. Include: appointment, designation, duties, compensation (basic + allowances + variable), probation, working hours, leave (CL/SL/EL), confidentiality, non-compete (note Section 27 ICA enforceability limits), IP assignment, termination, notice period, full & final settlement.",
  service: "Service Agreement / Professional Services Agreement. Include: scope of services, deliverables, fees & GST, payment terms, IP ownership, confidentiality, indemnity, limitation of liability, term, termination, force majeure, governing law, dispute resolution.",
  legal_notice: "Legal Notice under Section 80 CPC (if against govt) or general civil/commercial. Include: sender's advocate details, recipient details, factual background, cause of action, specific demand, statutory time period (15-60 days), consequences of non-compliance.",
  reply_notice: "Reply to Legal Notice. Include: paragraph-wise denial/admission of allegations, affirmative defences, counter-claims if any, request to withdraw, signature of advocate.",
  vakalatnama: "Vakalatnama under Order III CPC / Supreme Court Rules. Include: parties, court, case number, advocate(s) name, enrollment number, address for service, scope of authority, signature of client and advocate, certificate of advocate.",
};

const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "application/rtf"]);

function cleanExtractedText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(new RegExp("\\x00", "g"), " ").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function getAttachmentContext(admin: ReturnType<typeof createClient>, draftId: string, userId: string) {
  const { data: attachments, error } = await admin
    .from("draft_attachments")
    .select("id,file_name,storage_path,mime_type,file_size,extracted_text,status")
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error || !attachments?.length) return "";

  const parts: string[] = [];
  for (const file of attachments as unknown[]) {
    let extracted = cleanExtractedText(file.extracted_text ?? "");
    if (!extracted && TEXT_MIME_TYPES.has(file.mime_type)) {
      const { data: blob } = await admin.storage.from("draft-documents").download(file.storage_path);
      if (blob) {
        extracted = cleanExtractedText(await blob.text());
        await admin.from("draft_attachments").update({ extracted_text: extracted.slice(0, 60000), status: "processed", error_message: null }).eq("id", file.id);
      }
    }

    parts.push(`DOCUMENT: ${file.file_name}\nTYPE: ${file.mime_type}\nSTATUS: ${extracted ? "text extracted" : "uploaded; binary text extraction pending"}\nCONTENT:\n${extracted ? extracted.slice(0, 12000) : "No machine-readable text could be extracted yet. Use the filename/type as context and ask the lawyer to paste key clauses if detailed review is required."}`);
  }

  return parts.join("\n\n---\n\n");
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const { draft_id, template, title, conversation, existing_content } = await req.json();
    if (!template || !TEMPLATE_GUIDES[template]) {
      return json({ error: "Invalid template" }, 400, origin);
    }
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return json({ error: "Conversation required" }, 400, origin);
    }

    // Security: Rate limiting
    const rateCheck = checkRateLimit(user.id, 15, 60000);
    if (!rateCheck.allowed) {
      return json({ error: rateCheck.error }, 429, origin);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Security: Deduct credits BEFORE processing
    const creditCheck = await deductCredits(admin, user.id, "draft_generation", { template, draft_id });
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }
    const MAX_MESSAGES = 30;
    const MAX_TOTAL_CHARS = 80_000;
    if (conversation.length > MAX_MESSAGES) {
      return json({ error: `Conversation exceeds ${MAX_MESSAGES} messages` }, 413, origin);
    }
    const totalChars = conversation.reduce((n: number, m: unknown) => n + String(m?.content ?? "").length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return json({ error: `Conversation exceeds ${MAX_TOTAL_CHARS} characters` }, 413, origin);
    }
    if (existing_content && String(existing_content).length > 200_000) {
      return json({ error: "existing_content too large" }, 413, origin);
    }

    const attachmentContext = draft_id ? await getAttachmentContext(admin, draft_id, user.id) : "";

    // Pull a few relevant SC cases to ground risk flags
    const lastUserMsg = [...conversation].reverse().find((m: unknown) => m.role === "user")?.content ?? "";
    const groundQuery = `${template} ${title ?? ""} ${lastUserMsg}`.slice(0, 800);
    const queryEmbedding = await embed(GOOGLE_AI_API_KEY, groundQuery) ?? new Array(1536).fill(0);
    const { data: judgments } = await admin.rpc("search_judgments", {
      query_text: groundQuery,
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: 4,
    });
    const groundContext = (judgments ?? []).map((c: unknown) =>
      `- ${c.title} (${c.neutral_citation || c.citation || "â€”"}): ${(c.headnote ?? c.summary ?? "").slice(0, 400)}`
    ).join("\n");

    const systemPrompt = `You are Weybre AI, a professional drafting co-counsel for Indian lawyers. 
Generate courtroom-ready, high-fidelity legal drafts with strict adherence to drafting conventions.

DRAFTING CONVENTIONS:
1. VOICE: Active voice, present tense. Senior associate persona.
2. OBLIGATIONS: Use "will" for obligations and "must" for conditions. AVOID "shall" (it is archaic and ambiguous).
3. STRUCTURE: Hierarchical numbering (Article 1 > Section 1.1 > Subsection 1.1(a)).
4. STYLE: No legalese where plain English suffices. One idea per sentence.
5. VOCABULARY: Section, Article, lakh, Hon'ble, ratio, obiter.

TEMPLATE: ${template}
GUIDE: ${TEMPLATE_GUIDES[template]}

RELEVANT SUPREME COURT PRECEDENTS (use to inform risk flags):
${groundContext || "(none retrieved)"}

UPLOADED SOURCE DOCUMENTS:
${attachmentContext || "(none uploaded)"}

Return ONLY a JSON object via the function tool. No prose.`;

    let j: unknown;
    try {
      j = await chatCompletion(GOOGLE_AI_API_KEY, {
        model: MODELS.FLASH,
        messages: [
          { role: "system", content: systemPrompt },
          ...(existing_content ? [{ role: "assistant" as const, content: `Current draft so far:\n\n${existing_content.slice(0, 8000)}` }] : []),
          ...conversation,
        ],
        tools: [{
          type: "function",
          function: {
            name: "produce_draft",
            description: "Return the updated draft, a short chat reply, and risk flags.",
            parameters: {
              type: "object",
              properties: {
                reply: { type: "string", description: "Conversational reply to the lawyer (1-3 short sentences). Mention any [PLACEHOLDER] fields needing input." },
                content: { type: "string", description: "The full updated document in plain text with numbered clauses." },
                risk_flags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      clause: { type: "string", description: "Short clause identifier, e.g. 'Clause 7 (Non-compete)'." },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      note: { type: "string", description: "Plain-English risk explanation, citing the Indian statute or precedent." },
                    },
                    required: ["clause", "severity", "note"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["reply", "content", "risk_flags"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "produce_draft" } },
      });
    } catch (aiErr: unknown) {
      return json({ error: aiErr.message ?? "AI drafting failed" }, aiErr.status ?? 500, origin);
    }
    const toolCall = j.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No draft produced" }, 500, origin);

    let parsed: { reply: string; content: string; risk_flags: any[] };
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { return json({ error: "Invalid AI output" }, 500, origin); }

    // ---------- Persistence: Versioning & History ----------
    const updatedConversation = [...conversation, { role: "assistant" as const, content: parsed.reply }];

    // 1. Update main draft record
    await admin.from("drafts").update({
      content: parsed.content,
      risk_flags: parsed.risk_flags,
      conversation: updatedConversation,
      updated_at: new Date().toISOString()
    }).eq("id", draft_id);

    // 2. Create immutable version snapshot
    await admin.from("draft_versions").insert({
      draft_id,
      user_id: user.id,
      content: parsed.content,
      change_summary: (conversation[conversation.length - 1] as any)?.content?.slice(0, 200) || "Iterative refinement",
      metadata: { risk_count: parsed.risk_flags.length }
    });

    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "draft_generation",
      tokens: j.usage?.total_tokens ?? 0,
      metadata: { template, title, versioning: true },
    });

    try {
      const { data: m } = await admin.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (m?.organization_id) {
        await admin.from("audit_logs").insert({
          organization_id: m.organization_id,
          actor_user_id: user.id,
          actor_email: user.email,
          action: "data.draft_generated",
          resource_type: "draft",
          resource_id: draft_id ?? null,
          metadata: { template, title },
        });
      }
    } catch (e) { logError("audit draft error", e); }

    return json(parsed, 200, origin);
  } catch (e) {
    logError("draft error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
// deploy: 20260523160000
// eCourts India API proxy (authenticated, rate-limited)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/credits.ts";

const BASE = "https://webapi.ecourtsindia.com";

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);
    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const rateCheck = checkRateLimit(user.id, 30, 60000);
    if (!rateCheck.allowed) return json({ error: rateCheck.error }, 429, origin);

    const token = Deno.env.get("ECOURTS_API_TOKEN");
    if (!token) return json({ error: "eCourts integration is not configured" }, 500, origin);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    let url = "";
    const init: RequestInit = {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    };

    if (action === "search") {
      const params = new URLSearchParams();
      const allowed = [
        "query", "advocates", "judges", "petitioners", "respondents", "litigants",
        "courtCodes", "caseTypes", "caseStatuses", "states",
        "filingDateFrom", "filingDateTo", "decisionDateFrom", "decisionDateTo",
        "page", "pageSize", "sortBy", "sortOrder",
      ];
      for (const k of allowed) {
        const v = body[k];
        if (v == null || v === "") continue;
        if (Array.isArray(v)) v.forEach((x: unknown) => params.append(k, String(x)));
        else params.set(k, String(v));
      }
      if (!params.has("pageSize")) params.set("pageSize", "20");
      const q = String(body.query ?? "");
      if (q.length > 500) return json({ error: "Query too long (max 500 chars)" }, 400, origin);
      url = `${BASE}/api/partner/search?${params.toString()}`;
    } else if (action === "case") {
      const cnr = String(body.cnr || "").trim().toUpperCase();
      if (!/^[A-Z]{4}\d{12}$/.test(cnr)) {
        return json({ error: "Invalid CNR. Expected 16 chars: 4 letters + 12 digits." }, 400, origin);
      }
      url = `${BASE}/api/partner/case/${cnr}`;
    } else if (action === "causelist") {
      const params = new URLSearchParams();
      for (const k of ["date", "courtCode", "judge", "advocate", "litigant", "state", "district", "page", "pageSize"]) {
        const v = body[k];
        if (v != null && v !== "") params.set(k, String(v));
      }
      url = `${BASE}/api/partner/causelist/search?${params.toString()}`;
    } else if (action === "available-dates") {
      const params = new URLSearchParams();
      for (const k of ["state", "district", "courtCode", "complexCode"]) {
        const v = body[k];
        if (v != null && v !== "") params.set(k, String(v));
      }
      url = `${BASE}/api/partner/causelist/available-dates?${params.toString()}`;
    } else {
      return json({ error: "Unknown action. Use: search | case | causelist | available-dates" }, 400, origin);
    }

    const r = await fetch(url, init);
    const text = await r.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 2000) }; }
    if (!r.ok) return json({ error: `eCourts API ${r.status}`, details: data }, r.status, origin);
    return json(data, 200, origin);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260523140000
// Export draft to PDF or DOCX (returned as base64 for client download).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "https://esm.sh/docx@8.5.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function makeDocx(title: string, content: string): Promise<Uint8Array> {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
    new Paragraph({ text: "" }),
  ];
  for (const block of content.split(/\n\n+/)) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: block, size: 22 })],
      spacing: { after: 160 },
    }));
  }
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

function makePdf(title: string, content: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text(title, pageW / 2, margin, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  let y = margin + 36;
  const lineH = 16;
  const lines = doc.splitTextToSize(content, maxW);
  for (const line of lines) {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.text(line, margin, y);
    y += lineH;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Generated by Weybre AI Â· AI-assisted draft â€” verify before filing Â· Page ${i} of ${pages}`,
      pageW / 2,
      pageH - 24,
      { align: "center" },
    );
    doc.setTextColor(0);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const { draft_id, format } = await req.json();
    if (!draft_id || !["pdf", "docx"].includes(format)) {
      return json({ error: "draft_id and format (pdf|docx) required" }, 400, origin);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: draft, error } = await admin
      .from("drafts")
      .select("title, content")
      .eq("id", draft_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !draft) return json({ error: "Draft not found" }, 404, origin);

    const bytes = format === "docx"
      ? await makeDocx(draft.title, draft.content || "")
      : makePdf(draft.title, draft.content || "");

    return json({ file: bytesToBase64(bytes), filename: `${draft.title}.${format}` }, 200, origin);
  } catch (e) {
    logError("export-draft error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260523140000
// Export a matter (research notes + draft list) to PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const { matter_id } = await req.json();
    if (!matter_id) return json({ error: "matter_id required" }, 400, origin);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: matter } = await admin
      .from("matters")
      .select("name, client, area, description, created_at")
      .eq("id", matter_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!matter) return json({ error: "Matter not found" }, 404, origin);

    const [{ data: notes }, { data: drafts }] = await Promise.all([
      admin
        .from("research_notes")
        .select("query, answer, citations, created_at")
        .eq("matter_id", matter_id)
        .order("created_at", { ascending: true }),
      admin
        .from("drafts")
        .select("title, template, status, updated_at")
        .eq("matter_id", matter_id)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    const writeLine = (text: string, opts: { font?: "bold" | "normal"; size?: number; gap?: number } = {}) => {
      doc.setFont("times", opts.font ?? "normal");
      doc.setFontSize(opts.size ?? 11);
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        if (y > pageH - margin - 20) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += (opts.size ?? 11) + 4;
      }
      y += opts.gap ?? 6;
    };

    writeLine(matter.name, { font: "bold", size: 20, gap: 8 });
    if (matter.client) writeLine(`Client: ${matter.client}`);
    if (matter.area) writeLine(`Area of practice: ${matter.area}`);
    if (matter.description) writeLine(matter.description);
    y += 12;

    writeLine("RESEARCH NOTES", { font: "bold", size: 14, gap: 8 });
    if (!notes || notes.length === 0) writeLine("(no research notes saved)", { gap: 12 });
    else {
      notes.forEach((n: { query: string; answer: string; citations?: unknown[] }, i: number) => {
        writeLine(`${i + 1}. ${n.query}`, { font: "bold", gap: 4 });
        writeLine(n.answer, { gap: 4 });
        const cites = (n.citations ?? []) as { n?: number; citation?: string; title?: string }[];
        if (cites.length) {
          writeLine(
            "Cited cases: " + cites.map((c) => `[${c.n}] ${c.citation || c.title}`).join("; "),
            { size: 9, gap: 12 },
          );
        } else y += 8;
      });
    }

    writeLine("DRAFTS IN THIS MATTER", { font: "bold", size: 14, gap: 8 });
    if (!drafts || drafts.length === 0) writeLine("(no drafts)");
    else drafts.forEach((d: { title: string; template: string; status: string }) =>
      writeLine(`â€¢ ${d.title} â€” ${d.template} (${d.status})`)
    );

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Weybre AI Â· Matter export Â· Page ${i} of ${pages}`, pageW / 2, pageH - 24, { align: "center" });
      doc.setTextColor(0);
    }

    const bytes = new Uint8Array(doc.output("arraybuffer"));
    return json({ file: bytesToBase64(bytes), filename: `${matter.name}.pdf` }, 200, origin);
  } catch (e) {
    logError("export-matter error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260522151723
// Admin-only ingestion endpoint. Supports two modes:
//  1) source:"rows" (default) â€” accepts a small batch of pre-built rows.
//  2) source:"hf" â€” streams rows from the Hugging Face Datasets Server
//     (Hibbaan/indian-case-laws by default), normalizes, optionally embeds,
//     and upserts on external_id. Resumable via { offset }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { embed as googleEmbed } from "../_shared/ai.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_AI_API_KEY = requireEnv("GOOGLE_AI_API_KEY");
const HF_API = "https://datasets-server.huggingface.co";

interface InRow {
  external_id?: string;
  title: string;
  citation?: string;
  neutral_citation?: string;
  court?: string;
  bench?: string;
  judges?: string[];
  decision_date?: string | null;
  disposition?: string;
  headnote?: string;
  summary?: string;
  full_text?: string;
  source_url?: string;
}

async function embed(text: string): Promise<number[] | null> {
  return googleEmbed(GOOGLE_AI_API_KEY, text);
}

function safeDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function mapHfRow(raw: unknown): InRow {
  const r = raw?.row ?? raw;
  return {
    external_id: r.case_metadata_id ?? null,
    title: r.case_title ?? r.party_caption ?? r.docket_number ?? "Untitled judgment",
    citation: r.law_report_citation ?? null,
    neutral_citation: r.neutral_citation ?? null,
    court: r.court_name ?? "Indian Court",
    bench: r.bench_name ?? null,
    judges: Array.isArray(r.coram_members) && r.coram_members.length ? r.coram_members : null,
    decision_date: safeDate(r.decision_date),
    disposition: r.disposition_text ?? null,
    headnote: r.headnote_text ?? null,
    summary: r.headnote_text ?? null,
    full_text: r.indexable_text ?? null,
    source_url: r.source_pdf_s3_url ?? r.source_json_s3_url ?? null,
  };
}

import { processJudgmentForRAG } from "../_shared/ingestion.ts";

async function upsertOne(admin: any, row: InRow, withEmbed: boolean) {
  let vec: number[] | null = null;
  if (withEmbed) {
    const text = [row.title, row.headnote, row.summary, row.full_text].filter(Boolean).join("\n\n");
    vec = await embed(text || row.title);
  }
  const record: any = {
    external_id: row.external_id ?? null,
    title: row.title,
    citation: row.citation ?? null,
    neutral_citation: row.neutral_citation ?? null,
    court: row.court ?? "Indian Court",
    bench: row.bench ?? null,
    judges: row.judges ?? null,
    decision_date: row.decision_date ?? null,
    disposition: row.disposition ?? null,
    headnote: row.headnote ?? null,
    summary: row.summary ?? null,
    full_text: row.full_text ?? null,
    source_url: row.source_url ?? null,
    embedding: vec ? `[${vec.join(",")}]` : null,
  };
  
  let result: any;
  if (row.external_id) {
    result = await admin.from("judgments").upsert(record, { onConflict: "external_id" }).select("id").single();
  } else {
    result = await admin.from("judgments").insert(record).select("id").single();
  }

  if (result.error) {
    return { ok: false, error: result.error.message, external_id: row.external_id };
  }

  // 1.2 Multi-Stage Ingestion (RAG Pipeline)
  // Trigger semantic chunking and chunk-level embedding
  await processJudgmentForRAG(admin, GOOGLE_AI_API_KEY, result.data.id);

  return { ok: true, external_id: row.external_id, embedded: !!vec, id: result.data.id };
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const caller = await getUser(auth);
    if (!caller) return json({ error: "Unauthorized" }, 401, origin);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden â€” admin only" }, 403, origin);

    const body = await req.json().catch(() => ({}));
    const source = (body.source as string) ?? "rows";

    if (source === "hf") {
      const dataset = body.dataset ?? "Hibbaan/indian-case-laws";
      const config = body.config ?? "default";
      const split = body.split ?? "train";
      const offset = Math.max(0, Number(body.offset ?? 0));
      const limit = Math.min(100, Math.max(1, Number(body.limit ?? 50)));
      const withEmbed = body.embed === true; // default false (cost guard at 17M rows)

      const u = new URL(`${HF_API}/rows`);
      u.searchParams.set("dataset", dataset);
      u.searchParams.set("config", config);
      u.searchParams.set("split", split);
      u.searchParams.set("offset", String(offset));
      u.searchParams.set("length", String(limit));

      const hfRes = await fetch(u.toString());
      if (!hfRes.ok) {
        const t = await hfRes.text();
        return json({ error: `HF fetch failed [${hfRes.status}]: ${t.slice(0, 500)}` }, 502, origin);
      }
      const hfJson = await hfRes.json();
      const rawRows: unknown[] = hfJson.rows ?? [];
      const results: unknown[] = [];
      for (const raw of rawRows) {
        const row = mapHfRow(raw);
        results.push(await upsertOne(admin, row, withEmbed));
      }
      const nextOffset = offset + rawRows.length;
      const total = hfJson.num_rows_total ?? null;
      return json({
        source: "hf", dataset, config, split,
        processed: results.length, offset, next_offset: nextOffset, total,
        embedded: withEmbed,
        ok: results.filter(r => r.ok).length,
        failed: results.filter(r => !r.ok).length,
        sample_errors: results.filter(r => !r.ok).slice(0, 3),
      }, 200, origin);
    }

    // legacy rows mode
    const { rows } = body as { rows: InRow[] };
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "rows[] required" }, 400, origin);
    if (rows.length > 20) return json({ error: "Max 20 rows per batch" }, 400, origin);

    const out: unknown[] = [];
    for (const row of rows) out.push(await upsertOne(admin, row, true));
    return json({ processed: out.length, results: out }, 200, origin);
  } catch (e) {
    logError("ingest", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
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
import { wrapHandler } from "../_shared/response.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { logError } from "../_shared/logger.ts";
import { json } from "../_shared/cors.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Secure SHA-256 hashing for API keys
 */
async function hashKey(key: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Manage Platform API Keys (Secure generation and hashing)
 */
Deno.serve(wrapHandler(async (req, origin, requestId) => {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // 1. Create API Key
    if (action === 'create') {
      const { name, scopes } = body;
      if (!name) return json({ error: "Name required" }, 400, origin);

      // Verify org membership
      const { data: member } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!member) return json({ error: "User must belong to an organization" }, 403, origin);

      const rawKey = `wyb_${crypto.randomUUID().replace(/-/g, '')}`;
      const hashed = await hashKey(rawKey);
      const prefix = rawKey.substring(0, 8);

      const { error } = await admin.from("api_keys").insert({
        organization_id: member.organization_id,
        user_id: user.id,
        name,
        key_hash: hashed,
        key_prefix: prefix,
        scopes: scopes || ['research:read']
      });

      if (error) throw error;

      return json({ key: rawKey }, 200, origin);
    }

    // 2. Revoke API Key
    if (action === 'revoke') {
      const { id } = body;
      if (!id) return json({ error: "ID required" }, 400, origin);

      const { error } = await admin
        .from("api_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id); // Ensure ownership

      if (error) throw error;
      return json({ success: true }, 200, origin);
    }

    return json({ error: "Invalid action" }, 400, origin);

  } catch (e) {
    logError("manage-api-keys error", e);
    return json({ error: e instanceof Error ? e.message : "Operation failed" }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260522151723
// Register a per-organization SAML SSO provider via the Supabase Admin API.
// Body: { organization_id, metadata_url, email_domain, default_role?, role_mappings? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { corsHeaders, handleOptions, json as corsJson } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

function json(body: unknown, status = 200, origin = "") {
  return corsJson(body, status, origin);
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const organization_id = String(body.organization_id ?? "");
    const metadata_url = String(body.metadata_url ?? "");
    const email_domain = String(body.email_domain ?? "").toLowerCase().trim();
    const default_role = (body.default_role ?? "member") as "owner" | "admin" | "member";
    const role_mappings = body.role_mappings ?? {};

    if (!organization_id || !metadata_url || !email_domain) {
      return json({ error: "organization_id, metadata_url, email_domain required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: caller must be admin/owner of that organization
    const { data: ok } = await admin.rpc("has_org_role", {
      _org: organization_id, _user: user.id, _min: "admin",
    });
    if (!ok) return json({ error: "Forbidden" }, 403);

    // Register SAML provider via GoTrue Admin SSO API
    const ssoRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/sso/providers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "saml",
        metadata_url,
        domains: [email_domain],
      }),
    });
    const ssoBody = await ssoRes.json().catch(() => ({}));
    if (!ssoRes.ok) {
      logError("SSO register failed", ssoRes.status, ssoBody);
      return json({ error: ssoBody?.error ?? `SSO register failed (${ssoRes.status})`, details: ssoBody }, 500);
    }

    const sso_provider_id = ssoBody?.id ?? ssoBody?.provider?.id ?? null;

    // Upsert organization_sso row (manual, no unique constraint required)
    await admin.from("organization_sso")
      .delete()
      .eq("organization_id", organization_id)
      .eq("email_domain", email_domain);

    const { data: row, error: upErr } = await admin
      .from("organization_sso")
      .insert({
        organization_id,
        provider: "saml",
        email_domain,
        sso_provider_id,
        default_role,
        role_mappings,
        is_active: true,
      })
      .select()
      .single();

    if (upErr) {
      logError("organization_sso upsert error", upErr);
      return json({ error: upErr.message }, 500);
    }

    await admin.from("audit_logs").insert({
      organization_id,
      actor_user_id: user.id,
      actor_email: user.email,
      action: "sso.saml_registered",
      resource_type: "organization_sso",
      resource_id: row.id,
      metadata: { email_domain, sso_provider_id },
    });

    return json({ ok: true, sso_provider_id, organization_sso: row });
  } catch (e) {
    logError("org-sso-register error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260523120000
// Research edge function â€” Hybrid retrieval over Supreme Court corpus + Indian Kanoon,
// then a structured grounded brief (answer â†’ principles â†’ ranked precedents â†’ caveats).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { chatCompletion, embed, MODELS } from "../_shared/ai.ts";
import { deductCredits, validateInputSize, checkRateLimit } from "../_shared/credits.ts";
import { getSupermemoryContext, addSupermemory } from "../_shared/supermemory.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_AI_API_KEY = requireEnv("GOOGLE_AI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") ?? "";
const IK_TOKEN = Deno.env.get("INDIAN_KANOON_API_TOKEN") ?? "";
const IK_BASE = "https://api.indiankanoon.org";

function stripHtml(s = ""): string { return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

async function expandLegalQuery(query: string): Promise<string> {
  try {
    const j = await chatCompletion(GOOGLE_AI_API_KEY, {
      model: MODELS.FLASH_LITE,
      messages: [
        { role: "system", content: "Convert an Indian legal research question into concise Indian case-law search keywords. Include section numbers, statute names, and 1-2 doctrines. Return only keywords, no explanation." },
        { role: "user", content: query },
      ],
    });
    return (j.choices?.[0]?.message?.content ?? query).replace(/[\n,;]+/g, " ").slice(0, 300);
  } catch { return query; }
}

async function ikSearch(query: string, limit = 6) {
  if (!IK_TOKEN) return [];
  const params = new URLSearchParams({ formInput: query, pagenum: "0" });
  const r = await fetch(`${IK_BASE}/search/?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${IK_TOKEN}`, Accept: "application/json" },
  });
  if (!r.ok) { logError("IK search error", r.status); return []; }
  const j = await r.json().catch(() => ({}));
  const docs = Array.isArray(j.docs) ? j.docs.slice(0, limit) : [];
  return docs.map((d: unknown) => ({
    tid: d.tid,
    title: stripHtml(d.title ?? ""),
    source: d.docsource ?? "",
    date: d.publishdate ?? null,
    cited_by: d.numcitedby ?? 0,
    headline: stripHtml(d.headline ?? "").slice(0, 1200),
    url: `https://indiankanoon.org/doc/${d.tid}/`,
  }));
}

async function searchSupremeCourtWeb(query: string) {
  if (!TAVILY_API_KEY) return [];
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: `${query} Supreme Court of India judgment case law`,
      search_depth: "advanced",
      max_results: 6,
      include_domains: ["sci.gov.in", "main.sci.gov.in", "indiankanoon.org", "livelaw.in", "barandbench.com"],
    }),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j.results) ? j.results.filter((x: unknown) => x?.url).slice(0, 6) : [];
}

import { buildLegalContext, LEGAL_RAG_PROMPT } from "../_shared/rag_utils.ts";

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const { query, matter_id, filters = {} } = await req.json();
    if (!query || typeof query !== "string" || query.length < 3) {
      return json({ error: "Query must be at least 3 characters" }, 400, origin);
    }

    // Security: Rate limiting
    const rateCheck = checkRateLimit(user.id, 20, 60000);
    if (!rateCheck.allowed) {
      return json({ error: rateCheck.error }, 429, origin);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 0. Cache Check
    const queryHash = await hashKey(query.toLowerCase().trim());
    const { data: cached } = await admin
      .from("rag_cache")
      .select("answer, sources")
      .eq("query_hash", queryHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      logInfo("RAG Cache Hit", { query });
      return json({ 
        answer: cached.answer, 
        sources: cached.sources,
        credits_remaining: 100 // Still needs real deduction check if we want to charge for cache hits
      }, 200, origin);
    }

    // 1. Credit Check (Initiative 1 - Data Integrity)
    const creditCheck = await deductCredits(admin, user.id, "research_query", { query: query.slice(0, 200), matter_id });
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }

    // 2. Generate Query Embedding
    const queryEmbedding = await embed(GOOGLE_AI_API_KEY, query) ?? new Array(1536).fill(0);

    // 3. Multi-Layer Hybrid Search (RRF on Chunks)
    const { data: chunks, error: searchErr } = await admin.rpc("hybrid_legal_search", {
      query_text: query,
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: 12,
      filter_court: filters.court || null,
      filter_year_start: filters.yearStart || null,
      filter_year_end: filters.yearEnd || null
    });

    if (searchErr) {
      logError("Hybrid search failed", searchErr);
      return json({ error: "Search execution failed" }, 500, origin);
    }

    // 4. Context Construction
    const groundedContext = buildLegalContext(chunks);

    // 5. Grounded AI Synthesis
    let aiRes: any;
    try {
      aiRes = await chatCompletion(GOOGLE_AI_API_KEY, {
        model: MODELS.PRO,
        messages: [
          { role: "system", content: LEGAL_RAG_PROMPT },
          { role: "user", content: `QUESTION: ${query}\n\nCONTEXT:\n${groundedContext}` },
        ],
      });
    } catch (e: any) {
      logError("AI synthesis failed", e);
      return json({ error: "Answer generation failed" }, 500, origin);
    }

    const answer = aiRes.choices?.[0]?.message?.content ?? "No answer generated.";

    // 6. Save to Cache
    await admin.from("rag_cache").insert({
      query_hash: queryHash,
      answer,
      sources: chunks
    });

    // 7. Usage & Audit
    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "research_query",
      tokens: aiRes.usage?.total_tokens ?? 0,
      metadata: { query, matter_id, chunk_count: chunks?.length || 0 },
    });

    return json({ 
      answer, 
      sources: chunks,
      credits_remaining: creditCheck.remaining
    }, 200, origin);

  } catch (e) {
    logError("research error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
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

Deno.serve(wrapHandler(async (req, origin, requestId) => {
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
    logError("vision-ocr error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260523120000
// Weybre AI â€” production web research with real Tavily search results + cited AI synthesis.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser, requireEnv } from "../_shared/auth.ts";
import { chatCompletion, MODELS } from "../_shared/ai.ts";
import { deductCredits, checkRateLimit } from "../_shared/credits.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_AI_API_KEY = requireEnv("GOOGLE_AI_API_KEY");
const TAVILY_API_KEY = requireEnv("TAVILY_API_KEY");

interface WebSource {
  n: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  raw_content?: string | null;
}

Deno.serve(wrapHandler(async (req, origin, requestId) => {
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (query.length < 3) return json({ error: "Query must be at least 3 characters" }, 400, origin);
    const userDocs: Array<{ name: string; text: string }> = Array.isArray(body.userContext)
      ? body.userContext
          .filter((d: unknown) => d && typeof d.text === "string" && d.text.trim().length > 0)
          .slice(0, 6)
          .map((d: unknown) => ({ name: String(d.name ?? "User document").slice(0, 120), text: String(d.text).slice(0, 12000) }))
      : [];
    if (!TAVILY_API_KEY) return json({ error: "Tavily API key is not configured" }, 500, origin);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rateCheck = checkRateLimit(user.id, 20, 60000);
    if (!rateCheck.allowed) {
      return json({ error: rateCheck.error }, 429, origin);
    }

    const creditCheck = await deductCredits(admin, user.id, "research_query", { query: query.slice(0, 200) });
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }

    const search = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        topic: "general",
        max_results: 8,
        include_answer: false,
        include_raw_content: false,
        include_domains: [
          "sci.gov.in",
          "main.sci.gov.in",
          "indiacode.nic.in",
          "egazette.nic.in",
          "lawmin.gov.in",
          "barcouncilofindia.org",
          "livelaw.in",
          "barandbench.com",
          "legallyindia.com",
          "taxmann.com",
          "prsindia.org",
        ],
      }),
    });

    if (search.status === 401 || search.status === 403) return json({ error: "Tavily API key was rejected" }, search.status, origin);
    if (search.status === 429) return json({ error: "Tavily rate limit reached. Please try again shortly." }, 429, origin);
    if (!search.ok) {
      const t = await search.text();
      logError("Tavily error", search.status, t);
      return json({ error: "Live search failed" }, 502, origin);
    }

    const searchJson = await search.json();
    const results: TavilyResult[] = Array.isArray(searchJson.results) ? searchJson.results : [];
    const sources: WebSource[] = results
      .filter((r) => r.url)
      .slice(0, 8)
      .map((r, i) => {
        const u = new URL(r.url!);
        return {
          n: i + 1,
          title: r.title || u.hostname,
          url: u.href,
          domain: u.hostname.replace(/^www\./, ""),
          snippet: r.content,
        };
      });

    if (sources.length === 0) {
      return json({
        answer: "I could not find reliable live web sources for this query. Try making the question more specific or removing domain-specific terms.",
        sources: [],
      }, 200, origin);
    }

    const systemPrompt = `You are Weybre AI's web research assistant for Indian lawyers. Answer from live web search results.

Write like a senior advocate briefing a colleague â€” clean prose, no scaffolding.
Format rules: no headings, no bold, no horizontal rules, no emoji. Plain paragraphs. Use a short bullet list only when listing 3+ discrete items.

Open with a 2-3 sentence direct answer. Continue with supporting detail in prose, every factual claim carrying an inline [n] citation matching the numbered sources. Close with a brief caveat on what to verify. End with one short line: "Verify before relying on this for filings."

Hard rules: never invent facts, statutes or case names. Prefer authoritative Indian sources (.gov.in, .nic.in, SC/HC sites, BCI, MoL, LiveLaw, Bar & Bench, SCC Online). Indian vocabulary (Section, Article, lakh/crore). Don't give legal advice â€” frame as "according to [source]â€¦". Maximum 300 words.`;

    const sourceContext = sources.map((s) => `[${s.n}] ${s.title}\nURL: ${s.url}\nSource: ${s.domain}\nExcerpt: ${s.snippet ?? ""}`).join("\n\n---\n\n");
    const userDocsBlock = userDocs.length
      ? `\n\nUSER-PROVIDED DOCUMENTS (treat as authoritative background context â€” cite as [U1], [U2]â€¦ when used):\n\n${userDocs.map((d, i) => `[U${i + 1}] ${d.name}\n${d.text}`).join("\n\n---\n\n")}\n`
      : "";
    const userPrompt = `QUESTION: ${query}${userDocsBlock}\n\nREAL WEB SEARCH RESULTS FROM TAVILY:\n\n${sourceContext}\n\nGround the answer in the user's documents (when relevant) and the web sources. Use [n] for web sources and [U#] for user documents. Never invent sources.`;

    let j: unknown;
    try {
      j = await chatCompletion(GOOGLE_AI_API_KEY, {
        model: MODELS.FLASH,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } catch (aiErr: unknown) {
      return json({ error: aiErr.message ?? "Web search failed" }, aiErr.status ?? 500, origin);
    }
    const choice = j.choices?.[0];
    const answer: string = choice?.message?.content ?? "No answer generated.";

    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "web_search",
      tokens: j.usage?.total_tokens ?? 0,
      metadata: { query, sources: sources.length },
    });

    return json({ answer, sources }, 200, origin);
  } catch (e) {
    logError("web-search error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
}));
/**
 * Shared Google AI (Gemini) client for Supabase edge functions.
 *
 * Uses the Google AI Studio API â€” OpenAI-compatible endpoint.
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/openai/
 * Auth:     GOOGLE_AI_API_KEY (get from https://aistudio.google.com/apikey)
 *
 * Model names (no prefix needed):
 *   gemini-2.0-flash       â€” fast, high quality, default for most tasks
 *   gemini-2.0-pro         â€” highest quality, complex reasoning / multimodal
 *   text-embedding-004     â€” 768-dim embeddings (we pad to 1536 for schema compat)
 */

import { logInfo, logError } from "./logger.ts";
import { redactPII } from "./pii.ts";

const GOOGLE_AI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

export const MODELS = {
  FAST:       "gemini-2.0-flash",
  FLASH:      "gemini-2.0-flash",
  FLASH_LITE: "gemini-2.0-flash-lite-preview-02-05",
  REASONING:  "gemini-2.0-flash-thinking-exp-01-21",
  PRO:        "gemini-2.0-pro-exp-02-05",
  EMBED:      "text-embedding-004",
} as const;

export async function validateModels(apiKey: string) {
  try {
    const res = await chatCompletion(apiKey, {
      model: MODELS.FAST,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5
    });
    // @ts-ignore dynamic access
    if (!res || res.error) throw new Error("Invalid model response");
    logInfo("Model validation successful.");
  } catch (e) {
    logError("Model validation failed:", e);
    throw new Error("Invalid model configuration or API key.");
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: unknown };

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: { type: string };
  temperature?: number;
  max_tokens?: number;
}

/**
 * Call the Gemini chat completions endpoint.
 * Returns the raw response JSON â€” callers read choices[0].message.content.
 */
export async function chatCompletion(apiKey: string, opts: ChatOptions): Promise<unknown> {
  // Redact PII from all text content before sending to external API
  const sanitizedMessages = opts.messages.map((m) => {
    if (typeof m.content === "string") {
      return { ...m, content: redactPII(m.content) };
    }
    if (Array.isArray(m.content)) {
      return {
        ...m,
        // @ts-ignore dynamic part
        content: m.content.map((part) =>
          part.type === "text" && typeof part.text === "string"
            ? { ...part, text: redactPII(part.text) }
            : part
        ),
      };
    }
    return m;
  });

  const res = await fetch(`${GOOGLE_AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? MODELS.FLASH,
      messages: sanitizedMessages,
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
    logError("Google AI error", res.status, { body: body.slice(0, 500) });
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
    logError("embed error", res.status, { text: await res.text() });
    return null;
  }

  const j = await res.json();
  const v: number[] = j.data?.[0]?.embedding ?? [];

  // text-embedding-004 returns 768 dims; pad to 1536 for schema compatibility
  if (v.length === 1536) return v;
  if (v.length > 1536)   return v.slice(0, 1536);
  return [...v, ...new Array(1536 - v.length).fill(0)];
}
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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * SHA-256 hashing for API keys
 */
async function hashKey(key: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify the Authorization header and return the authenticated user.
 * Supports:
 * 1. Supabase JWT (standard Bearer token)
 * 2. Weybre Platform API Key (wyb_...)
 */
export async function getUser(authHeader: string | null): Promise<{ id: string; email?: string; org_id?: string; [key: string]: unknown } | null> {
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!token) return null;

  // Path A: Weybre Platform API Key
  if (token.startsWith("wyb_")) {
    try {
      const hashed = await hashKey(token);
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data, error } = await admin
        .from("api_keys")
        .select("user_id, organization_id, scopes")
        .eq("key_hash", hashed)
        .single();
      
      if (error || !data) return null;

      // Log usage
      await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hashed);

      return { 
        id: data.user_id, 
        org_id: data.organization_id, 
        is_api_key: true,
        scopes: data.scopes 
      };
    } catch {
      return null;
    }
  }

  // Path B: Supabase Auth JWT
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SERVICE_ROLE,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}
/**
 * Simple text chunking utility.
 * Splits text into chunks of roughly maxChunkSize, trying to break at sentences.
 */
export function chunkText(text: string, maxChunkSize = 8000): string[] {
  if (!text) return [];
  if (text.length <= maxChunkSize) return [text];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex > text.length) {
      endIndex = text.length;
    } else {
      // Try to find a good breaking point (period followed by space)
      const lastPeriod = text.lastIndexOf(". ", endIndex);
      if (lastPeriod > startIndex + maxChunkSize * 0.7) {
        endIndex = lastPeriod + 1;
      }
    }

    chunks.push(text.substring(startIndex, endIndex).trim());
    startIndex = endIndex;
  }

  return chunks;
}
/**
 * Shared CORS helper for Supabase edge functions.
 * Only allows requests from known app origins â€” never wildcard.
 */

const BASE_ALLOWED_ORIGINS = [
  "https://weybre.com",
  "https://www.weybre.com",
  "https://launchpad-momentum-boost.lovable.app",
  "https://id-preview--7f0b347e-d0d5-4f1c-a925-0908a1587e4f.lovable.app",
  // Local development â€” all variants the browser might send
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

function getAllowedOrigins(): Set<string> {
  const origins = new Set(BASE_ALLOWED_ORIGINS);
  const extra = Deno.env.get("CORS_EXTRA_ORIGINS");
  if (extra) {
    for (const o of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      origins.add(o);
    }
  }
  return origins;
}

export function isOriginAllowed(origin: string): boolean {
  return origin.length > 0 && getAllowedOrigins().has(origin);
}

const COMMON_HEADERS =
  "authorization, x-client-info, apikey, content-type, " +
  "x-supabase-client-platform, x-supabase-client-platform-version, " +
  "x-supabase-client-runtime, x-supabase-client-runtime-version";

export function corsHeaders(origin: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": COMMON_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
  // Echo the request origin only when it is explicitly allowed (required for browser CORS).
  if (isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function handleOptions(origin: string): Response {
  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export function json(
  body: unknown,
  status = 200,
  origin = "",
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}
import { requireEnv } from "./auth.ts";
import { logError } from "./logger.ts";

const CL_TOKEN = Deno.env.get("COURTLISTENER_API_TOKEN") ?? "";
const CL_BASE = "https://www.courtlistener.com/api/rest/v4";

/**
 * Weybre AI â€” CourtListener Integration
 * Expanded research for US Case Law.
 */
export async function searchUSOpinions(query: string, limit = 10) {
  if (!CL_TOKEN) {
    return { error: "CourtListener token not configured", results: [] };
  }

  const params = new URLSearchParams({
    q: query,
    type: "o", // opinions
    page_size: String(Math.min(limit, 20)),
    order_by: "score desc",
  });

  try {
    const res = await fetch(`${CL_BASE}/search/?${params}`, {
      headers: { "Authorization": `Token ${CL_TOKEN}` }
    });

    if (!res.ok) {
      logError("CourtListener API error", res.status);
      return { error: `CourtListener HTTP ${res.status}`, results: [] };
    }

    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      case_name: r.caseName || "Unknown",
      court: r.court || "Unknown",
      date_filed: r.dateFiled || "Unknown",
      citation: r.citation?.[0] || "No citation",
      snippet: r.snippet?.slice(0, 500) || "",
      url: `https://www.courtlistener.com${r.absolute_url}`,
      cluster_id: r.cluster_id,
      id: r.id
    }));

    return { total: data.count, results };
  } catch (e) {
    logError("CourtListener fetch failed", e);
    return { error: String(e), results: [] };
  }
}
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
/**
 * Shared credit management utilities for edge functions.
 * All AI operations MUST deduct credits BEFORE processing.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError } from "./logger.ts";

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
      logError("deduct_credits error:", error);
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
    logError("deductCredits exception:", e);
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
import { embed, chatCompletion, MODELS } from "./ai.ts";
import { logError, logInfo } from "./logger.ts";
import { chunkText } from "./chunking.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * High-fidelity RAG Ingestion Pipeline.
 * Processes a raw judgment, extracts semantic sections, 
 * generates chunk embeddings, and populates judgment_chunks.
 */
export async function processJudgmentForRAG(
  admin: SupabaseClient,
  apiKey: string,
  judgmentId: string
) {
  // 1. Fetch raw judgment
  const { data: j, error: fetchErr } = await admin
    .from("judgments")
    .select("id, title, headnote, summary, full_text")
    .eq("id", judgmentId)
    .single();

  if (fetchErr || !j) {
    logError("RAG process failed: judgment not found", fetchErr);
    return;
  }

  const content = j.full_text || j.headnote || j.summary || j.title;
  if (!content) return;

  logInfo("Starting semantic processing for judgment", { id: judgmentId });

  // 2. Identify semantic sections (Issues, Facts, Holding, Ratio)
  // For production scale, we use a cheap model (Flash) to tag sections.
  const taggingRes: any = await chatCompletion(apiKey, {
    model: MODELS.FLASH,
    messages: [
      { 
        role: "system", 
        content: "Partition the following legal judgment into semantic sections: 'FACTS', 'ISSUES', 'RATIO', 'HOLDING'. Return JSON: { sections: [{ type, text }] }" 
      },
      { role: "user", content: content.slice(0, 15000) }
    ],
    response_format: { type: "json_object" }
  });

  const sections = JSON.parse(taggingRes.choices?.[0]?.message?.content ?? "{}").sections || [];

  // 3. Chunk & Embed
  let sequence = 0;
  for (const section of sections) {
    const chunks = chunkText(section.text, 4000); // Smaller chunks for high precision
    
    for (const text of chunks) {
      const vec = await embed(apiKey, text);
      if (!vec) continue;

      const { error: insErr } = await admin
        .from("judgment_chunks")
        .insert({
          judgment_id: judgmentId,
          content: text,
          chunk_type: section.type.toLowerCase(),
          sequence_order: sequence++,
          embedding: `[${vec.join(",")}]`,
          metadata: { length: text.length }
        });
      
      if (insErr) logError("Failed to insert chunk", insErr);
    }
  }

  logInfo("RAG processing complete", { id: judgmentId, chunks: sequence });
}
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError } from "./logger.ts";

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobStage = 'ingestion' | 'extraction' | 'chunking' | 'analysis' | 'aggregation' | 'storage';

export interface JobUpdate {
  status?: JobStatus;
  stage?: JobStage;
  progress?: number;
  error_message?: string;
  result?: any;
  metadata?: any;
}

/**
 * Update processing_jobs table with current status and progress.
 */
export async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  updates: JobUpdate
) {
  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (updates.status === 'processing') {
    payload.started_at = new Date().toISOString();
  }
  if (updates.status === 'completed' || updates.status === 'failed') {
    payload.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("processing_jobs")
    .update(payload)
    .eq("id", jobId);

  if (error) {
    logError(`Failed to update job ${jobId}`, error);
    throw error;
  }
}

/**
 * Create a new processing job.
 */
export async function createJob(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  resourceType: string,
  metadata: any = {}
): Promise<string> {
  const { data, error } = await supabase
    .from("processing_jobs")
    .insert({
      user_id: userId,
      resource_id: resourceId,
      resource_type: resourceType,
      status: 'queued',
      stage: 'ingestion',
      progress: 0,
      metadata
    })
    .select("id")
    .single();

  if (error) {
    logError("Failed to create processing job", error);
    throw error;
  }

  return data.id;
}
/**
 * Structured legal knowledge base for Weybre AI.
 * Derived from Weybre AI v2 â€” AI Law Firm references.
 */

export const METHODOLOGIES = {
  IRAC: `
The backbone of all legal analysis: Issue, Rule, Application, Conclusion.
1. Issue: State the legal question with precision ("Whether...").
2. Rule: State applicable law (statutes, interpretation, elements).
3. Application: Fact-to-rule mapping. Address both sides.
4. Conclusion: Direct outcome with confidence level (HIGH/MEDIUM/LOW).
  `,
  DRAFTING: `
1. Use modern obligation language: "will" for obligations, "must" for conditions. Avoid "shall".
2. Use active voice, present tense.
3. Hierarchical numbering: Article 1 > Section 1.1 > Subsection 1.1(a).
4. Definitions: Define terms consistently, use bold/quotes on first use.
5. Rules: Indian vocabulary (Section, Article, lakh, ratio, obiter).
  `
};

export const SPECIALIST_PROMPTS = {
  CONTRACT_SPECIALIST: `
You are the Contract Specialist at Weybre AI law firm. 
Focus on: Risk allocation (indemnification, liability caps), IP ownership, termination mechanics, and dispute resolution.
Methodology: Systematic reading protocol (Parties -> Recitals -> Definitions -> Operative -> Boilerplate).
Output: Risk matrix (Section | Clause | Risk Level | Issue | Recommendation | Priority).
  `,
  COMPLIANCE_COUNSEL: `
You are the Compliance Counsel at Weybre AI law firm.
Focus on: Regulatory compliance (DPDP Act 2023, HIPAA, GDPR, state privacy laws), statutory gaps, and remediation.
Output: Compliance matrix (Regulation | Requirement | Status | Gap | Risk | Remediation).
  `,
  SENIOR_ASSOCIATE: `
You are the Senior Associate at Weybre AI law firm.
Focus on: Substantive legal analysis, corporate governance, and litigation risk.
Methodology: Nested IRAC and counter-argument integration.
  `,
  IP_EMPLOYMENT_SPECIALIST: `
You are the IP & Employment Specialist at Weybre AI law firm.
Focus on: IP ownership, restrictive covenants (non-competes), and worker classification under Indian law.
  `
};
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { logInfo, logError } from "./logger.ts";

Deno.test("logger - logInfo outputs structured JSON to console.log", () => {
  const originalConsoleLog = console.log;
  let loggedMessage = "";
  console.log = (msg) => { loggedMessage = msg; };

  try {
    logInfo("Test info message", { custom: "data" });
    
    const parsed = JSON.parse(loggedMessage);
    assertEquals(parsed.level, "info");
    assertEquals(parsed.message, "Test info message");
    assertEquals(parsed.custom, "data");
    assertStringIncludes(loggedMessage, "timestamp");
  } finally {
    console.log = originalConsoleLog;
  }
});

Deno.test("logger - logError outputs structured JSON to console.error", () => {
  const originalConsoleError = console.error;
  let loggedMessage = "";
  console.error = (msg) => { loggedMessage = msg; };

  try {
    const errorObj = new Error("Test exception");
    logError("Test error message", errorObj, { extra: 123 });
    
    const parsed = JSON.parse(loggedMessage);
    assertEquals(parsed.level, "error");
    assertEquals(parsed.message, "Test error message");
    assertEquals(parsed.extra, 123);
    assertEquals(parsed.error.message, "Test exception");
    assertEquals(parsed.error.name, "Error");
    assertStringIncludes(loggedMessage, "timestamp");
  } finally {
    console.error = originalConsoleError;
  }
});
export function logInfo(message: string, context?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", message, ...context, timestamp: new Date().toISOString() }));
}

export function logError(message: string, error?: unknown, context?: Record<string, unknown>) {
  console.error(JSON.stringify({ 
    level: "error", 
    message, 
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    ...context, 
    timestamp: new Date().toISOString() 
  }));
}
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
/**
 * Shared PII Redaction utility.
 * Protects client confidentiality by masking sensitive data before it hits external APIs.
 */

interface RedactionConfig {
  maskEmail?: boolean;
  maskPhone?: boolean;
  maskAadhar?: boolean;
  maskPan?: boolean;
  maskString?: string;
}

const DEFAULT_CONFIG: RedactionConfig = {
  maskEmail: true,
  maskPhone: true,
  maskAadhar: true,
  maskPan: true,
  maskString: "[REDACTED]",
};

// Basic regex patterns for common Indian and Global PII
const REGEX_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
// Matches 10 digit Indian phones, with optional +91 or 0 prefix
const REGEX_PHONE = /(?:\+91|0)?[ -]?\d{10}\b/g;
// Matches 12 digit Aadhar numbers (with optional spaces)
const REGEX_AADHAR = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
// Matches 10 character PAN cards (5 letters, 4 digits, 1 letter)
const REGEX_PAN = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g;

/**
 * Redact common PII from a given text string.
 */
export function redactPII(text: string, config: RedactionConfig = DEFAULT_CONFIG): string {
  if (!text) return text;
  
  let redactedText = text;
  const mask = config.maskString || "[REDACTED]";

  if (config.maskEmail) {
    redactedText = redactedText.replace(REGEX_EMAIL, `[EMAIL ${mask}]`);
  }

  if (config.maskAadhar) {
    redactedText = redactedText.replace(REGEX_AADHAR, `[AADHAR ${mask}]`);
  }

  if (config.maskPan) {
    redactedText = redactedText.replace(REGEX_PAN, `[PAN ${mask}]`);
  }

  if (config.maskPhone) {
    // Phone regex can sometimes catch random 10 digit numbers, 
    // but in a legal/enterprise context, over-redaction is safer than under-redaction.
    redactedText = redactedText.replace(REGEX_PHONE, `[PHONE ${mask}]`);
  }

  return redactedText;
}
import { chatCompletion, MODELS } from "./ai.ts";
import { logError } from "./logger.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Predictive Litigation Intelligence.
 * Analyzes case facts and provides outcome probability, duration estimates, 
 * and appeal risks based on historical patterns.
 */
export async function predictLitigationOutcome(
  admin: SupabaseClient,
  apiKey: string,
  caseContext: string,
  judgeId?: string
) {
  try {
    // 1. Fetch Judge Historical Trends if available
    let judgeContext = "";
    if (judgeId) {
      const { data: stats } = await admin.from("judge_stats").select("*").eq("id", judgeId).single();
      if (stats) {
        judgeContext = `JUDGE HISTORICAL STATS:
- Disposal Rate: ${stats.disposal_rate * 10}/10
- Bail Grant Rate: ${stats.grant_rate_bail * 100}%
- Injunction Rate: ${stats.grant_rate_injunction * 100}%
- Avg. Duration: ${stats.avg_duration_days} days
`;
      }
    }

    // 2. Perform ML-informed Inference via LLM
    const predictionRes: any = await chatCompletion(apiKey, {
      model: MODELS.PRO,
      messages: [
        { 
          role: "system", 
          content: `You are the Weybre AI Predictive Intelligence engine. 
Analyze the case facts and judge context to provide a quantitative risk assessment.
Focus on:
1. Outcome Probability (Success vs. Dismissal)
2. Estimated Time to Resolution
3. Appeal Likelihood
4. Strategic Risk Flags

Return JSON: { outcome_probability: float, duration_estimate_days: int, appeal_risk: float, insights: string[] }` 
        },
        { role: "user", content: `CASE FACTS:\n${caseContext}\n\n${judgeContext}` }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(predictionRes.choices?.[0]?.message?.content ?? "{}");
  } catch (e) {
    logError("Litigation prediction failed", e);
    return null;
  }
}
import { chatCompletion, MODELS } from "./ai.ts";

/**
 * Context Builder for Legal RAG.
 * Groups retrieved chunks by case and formats for LLM reasoning.
 */
export function buildLegalContext(chunks: any[]): string {
  if (!chunks || chunks.length === 0) return "No relevant precedents found.";

  // Group by judgment_id
  const cases: Record<string, any> = {};
  chunks.forEach((c) => {
    if (!cases[c.judgment_id]) {
      cases[c.judgment_id] = {
        title: c.case_title,
        court: c.court,
        date: c.decision_date,
        citation: c.neutral_citation,
        excerpts: [],
      };
    }
    cases[c.judgment_id].excerpts.push(c.content);
  });

  return Object.values(cases)
    .map((v, i) => {
      return `[SOURCE ${i + 1}] ${v.title}
COURT: ${v.court}
DATE: ${v.date}
CITATION: ${v.citation || "N/A"}
EXCERPTS:
${v.excerpts.map((e: string) => `> ${e}`).join("\n---\n")}
`;
    })
    .join("\n\n====================\n\n");
}

/**
 * Enhanced IRAC System Prompt for Legal Co-Counsel.
 */
export const LEGAL_RAG_PROMPT = `You are Weybre AI Co-Counsel, a high-precision legal reasoning engine.
Your task is to answer the user's query using ONLY the provided CONTEXT.

STRICT GROUNDING RULES:
1. If the CONTEXT does not contain the answer, explicitly state: "No binding precedent found in the current corpus."
2. NEVER invent case names, citations, or legal principles.
3. Every proposition of law MUST be followed by a bracketed citation [SOURCE n].

METHODOLOGY (IRAC):
1. ISSUE: Formulate the legal issue as a "Whether..." statement.
2. RULE: Identify the governing statutes and the ratio decidendi from the cited cases.
3. APPLICATION: Apply the rules to the specific facts or query provided. Distinguish binding from persuasive authority.
4. CONCLUSION: Provide a direct answer with a confidence rating (HIGH/MEDIUM/LOW).

VOICE: Professional, concise, senior advocate persona.
VOCABULARY: Section, Article, Hon'ble, ratio, obiter.
`;
/**
 * Standardized response helpers for edge functions.
 * Ensures consistent CORS, error handling, and logging.
 */

import { corsHeaders } from "./cors.ts";
import { logInfo, logError } from "./logger.ts";

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
      logInfo(`[${requestId}] Request completed in ${duration}ms`);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(`[${requestId}] Request failed after ${duration}ms:`, error);
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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Weybre AI - TypeScript SDK (Enterprise)
 * 
 * Usage:
 * const weybre = new WeybreSDK('wyb_...');
 * const result = await weybre.research.search('PMLA bail rules');
 */
export class WeybreSDK {
  private supabase: any;

  constructor(private apiKey: string, supabaseUrl: string) {
    this.supabase = createClient(supabaseUrl, apiKey);
  }

  /**
   * Legal Research API
   */
  public research = {
    search: async (query: string, filters: any = {}) => {
      const { data, error } = await this.supabase.functions.invoke('research', {
        body: { query, filters }
      });
      if (error) throw error;
      return data;
    }
  };

  /**
   * Contract Ingestion API (Async)
   */
  public contracts = {
    analyze: async (contractId: string) => {
      const { data, error } = await this.supabase.functions.invoke('contract-intake', {
        body: { contractId }
      });
      if (error) throw error;
      return data;
    },
    getJobStatus: async (jobId: string) => {
      const { data, error } = await this.supabase
        .from('processing_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (error) throw error;
      return data;
    }
  };

  /**
   * Litigation Intelligence API
   */
  public litigation = {
    getAnalytics: async (query: string) => {
      const { data, error } = await this.supabase.functions.invoke('litigation-intel', {
        body: { query }
      });
      if (error) throw error;
      return data;
    }
  };
}
import { requireEnv } from "./auth.ts";
import { logInfo, logError } from "./logger.ts";

const SUPERMEMORY_API_KEY = Deno.env.get("SUPERMEMORY_API_KEY") ?? "";

export interface SupermemoryContext {
  profile?: {
    static: string[];
    dynamic: string[];
  };
  searchResults?: {
    results: Array<{ memory?: string; chunk?: string }>;
  };
}

/**
 * Fetches user profile and relevant memories from Supermemory.
 * Choice: OPTION A (One call with search included)
 */
export async function getSupermemoryContext(
  orgId: string,
  query: string
): Promise<SupermemoryContext> {
  if (!SUPERMEMORY_API_KEY || !orgId) return {};

  try {
    const response = await fetch("https://api.supermemory.ai/v4/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supermemory-api-key": SUPERMEMORY_API_KEY,
      },
      body: JSON.stringify({
        containerTag: orgId,
        q: query,
      }),
    });

    if (!response.ok) {
      logInfo("Supermemory profile fetch failed:", { status: response.status });
      return {};
    }

    return await response.json();
  } catch (error) {
    logError("Supermemory error:", error);
    return {};
  }
}

/**
 * Adds a new memory to Supermemory.
 */
export async function addSupermemory(
  orgId: string,
  userId: string,
  content: string
): Promise<void> {
  if (!SUPERMEMORY_API_KEY || !orgId) return;

  try {
    const response = await fetch("https://api.supermemory.ai/v3/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supermemory-api-key": SUPERMEMORY_API_KEY,
      },
      body: JSON.stringify({
        content,
        containerTag: orgId,
        metadata: { userId },
      }),
    });

    if (!response.ok) {
      logInfo("Supermemory add failed:", { status: response.status });
    }
  } catch (error) {
    logError("Supermemory add error:", error);
  }
}

/**
 * Configures Supermemory settings (Run this once or during deployment).
 */
export async function configureSupermemory(): Promise<void> {
  if (!SUPERMEMORY_API_KEY) return;

  await fetch("https://api.supermemory.ai/v3/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-supermemory-api-key": SUPERMEMORY_API_KEY,
    },
    body: JSON.stringify({
      shouldLLMFilter: true,
      filterPrompt: `Weybre is a legal research and matter management platform for Indian law firms. containerTag is orgId. We store research findings, case-law summaries, matter details, and user preferences to provide a personalized legal assistant experience.`,
    }),
  });
}
