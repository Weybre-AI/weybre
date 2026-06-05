import { wrapHandler } from "../_shared/response.ts";
// deploy: 20260522151723
// Weybre AI — Legal Decision Engine
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
Court/Source: ${c.source ?? "—"} | Date: ${c.date ?? "—"} | Cited by: ${c.cited_by ?? 0}
URL: ${c.url}
Excerpt: ${c.excerpt}`).join("\n\n---\n\n")
      : "(no precedents retrieved — answer from general Indian legal principles and clearly flag the absence of citations)";

    let systemPrompt = "";
    let userPrompt = "";

    const formatRules = `Write like a senior Indian advocate briefing a colleague — clean prose, minimal scaffolding.
Format rules: no headings, no bold, no horizontal rules, no emoji. Use a short bullet list only when listing 3+ discrete items; otherwise paragraphs. Inline [n] citations for every proposition. Keep total length tight (≤ 350 words).`;

    if (mode === "contract") {
      systemPrompt = `You are Weybre AI's contract risk analyst for Indian law. Review the clause/contract against retrieved Indian precedents.

${formatRules}

Open with a one-line risk verdict (Low / Medium / High) and the reason. Then walk through the flagged language, the risk, and a safer rewrite for each — quoting briefly. Mention the precedents relied on inline with [n]. End with one short line: "Verify before filing — AI-generated analysis."`;
      userPrompt = `CONTRACT/CLAUSE:\n${contractText}\n\nUSER CONTEXT:\n${problem || "(none)"}\n\nRETRIEVED INDIAN PRECEDENTS:\n${context}`;
    } else if (mode === "predict") {
      systemPrompt = `You are Weybre AI's outcome-prediction engine for Indian litigation. Estimate the likely outcome based ONLY on the retrieved cases.

${formatRules}

Open with a one-line estimate (Likely / Uncertain / Unlikely) and confidence (Low/Med/High). Then a short paragraph explaining the pattern across [n] cases — authority for and against. Close with 3-5 concrete next steps for the advocate. End with one short line: "Predictions are illustrative — verify before filing."`;
      userPrompt = `LEGAL PROBLEM:\n${problem}\n\nRETRIEVED INDIAN CASES:\n${context}`;
    } else {
      systemPrompt = `You are Weybre AI — an AI legal copilot for Indian advocates. Convert the user's real-world problem into actionable guidance grounded in retrieved Indian case law.

${formatRules}

Open with a 2-3 sentence direct answer. Then prose covering the key arguments the advocate can make (with [n]) and the counter-arguments to anticipate. Close with 3-5 concrete next steps — filings, sections to invoke, deadlines, evidence. End with one short line: "Verify before filing — AI-generated, not legal advice."`;
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
