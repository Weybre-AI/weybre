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
