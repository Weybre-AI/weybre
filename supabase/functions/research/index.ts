import { wrapHandler } from "../_shared/response.ts";
import { logInfo, logError } from "../_shared/logger.ts";
// deploy: 20260523120000
// Research edge function — Hybrid retrieval over Supreme Court corpus + Indian Kanoon,
// then a structured grounded brief (answer → principles → ranked precedents → caveats).
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
