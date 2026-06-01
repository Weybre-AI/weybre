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
  if (!r.ok) { console.error("IK search error", r.status); return []; }
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const { query, matter_id, userContext } = await req.json();
    if (!query || typeof query !== "string" || query.length < 3) {
      return json({ error: "Query must be at least 3 characters" }, 400, origin);
    }

    // Security: Validate input size
    const inputValidation = validateInputSize(query, 5000);
    if (!inputValidation.valid) {
      return json({ error: inputValidation.error }, 400, origin);
    }

    // Security: Rate limiting
    const rateCheck = checkRateLimit(user.id, 20, 60000);
    if (!rateCheck.allowed) {
      return json({ error: rateCheck.error }, 429, origin);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user's organization for Supermemory containerTag
    const { data: member } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const orgId = member?.organization_id;

    // Security: Deduct credits BEFORE processing
    const creditCheck = await deductCredits(admin, user.id, "research_query", { query: query.slice(0, 200), matter_id });
    if (!creditCheck.allowed) {
      return json({ error: creditCheck.error, credits_remaining: 0 }, 402, origin);
    }
    const userDocs: Array<{ name: string; text: string }> = Array.isArray(userContext)
      ? userContext
          .filter((d: unknown) => d && typeof d.text === "string" && d.text.trim().length > 0)
          .slice(0, 6)
          .map((d: unknown) => ({ name: String(d.name ?? "User document").slice(0, 120), text: String(d.text).slice(0, 12000) }))
      : [];

    const queryEmbedding = await embed(GOOGLE_AI_API_KEY, query) ?? new Array(1536).fill(0);

    // ---------- 1. Parallel retrieval: Internal + Kanoon + Supermemory ----------
    const [internalRes, ikDocs, smContext] = await Promise.all([
      admin.rpc("search_judgments", {
        query_text: query,
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: 6,
      }),
      ikSearch(query, 6),
      orgId ? getSupermemoryContext(orgId, query) : Promise.resolve({}),
    ]);

    if (internalRes.error) console.error("search error", internalRes.error);
    let internal = internalRes.data ?? [];

    // Expand query if internal corpus is sparse
    if (internal.length < 3) {
      const expanded = await expandLegalQuery(query);
      const { data: more } = await admin.rpc("search_judgments", {
        query_text: expanded,
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: 6,
      });
      const seen = new Set(internal.map((c: unknown) => c.id));
      for (const c of more ?? []) if (!seen.has(c.id)) internal.push(c);
      internal = internal.slice(0, 6);
    }

    // ---------- 2. Build unified, ranked precedent list ----------
    type Source = {
      n: number;
      kind: "internal" | "kanoon";
      id: string;
      title: string;
      citation?: string | null;
      neutral_citation?: string | null;
      court?: string | null;
      bench?: string | null;
      judges?: string[] | null;
      decision_date?: string | null;
      headnote?: string | null;
      summary?: string | null;
      url?: string | null;
      cited_by?: number | null;
      similarity?: number | null;
      rank_score?: number;
    };

    const sources: Source[] = [];
    let n = 1;

    // Score internal: weight = similarity * 1.0 + recency bonus
    for (const c of internal) {
      const sim = Number(c.similarity ?? 0);
      const rk = Number(c.rank ?? 0);
      sources.push({
        n: n++,
        kind: "internal",
        id: c.id,
        title: c.title,
        citation: c.citation,
        neutral_citation: c.neutral_citation,
        court: c.court,
        bench: c.bench,
        judges: c.judges,
        decision_date: c.decision_date,
        headnote: c.headnote,
        summary: c.summary,
        similarity: sim,
        rank_score: 1.0 + sim * 0.6 + rk * 0.4, // internal corpus gets a base authority boost
      });
    }

    // De-dupe Kanoon vs internal by title similarity
    const internalTitles = new Set(internal.map((c: unknown) => (c.title ?? "").toLowerCase().slice(0, 60)));
    for (const d of ikDocs) {
      const key = d.title.toLowerCase().slice(0, 60);
      if (internalTitles.has(key)) continue;
      const cited = Number(d.cited_by || 0);
      sources.push({
        n: n++,
        kind: "kanoon",
        id: String(d.tid),
        title: d.title,
        citation: null,
        neutral_citation: null,
        court: d.source,
        bench: null,
        judges: null,
        decision_date: d.date,
        headnote: d.headline,
        summary: null,
        url: d.url,
        cited_by: cited,
        rank_score: 0.7 + Math.log10(1 + cited) * 0.15, // log-scale citation authority
      });
    }

    // Sort by combined precedent score, renumber
    sources.sort((a, b) => (b.rank_score ?? 0) - (a.rank_score ?? 0));
    sources.forEach((s, i) => { s.n = i + 1; });
    const ranked = sources.slice(0, 8);

    // ---------- 3. Fallback to live web if everything is empty ----------
    if (ranked.length === 0) {
      const webCases = await searchSupremeCourtWeb(query);
      if (webCases.length === 0) {
        return json({
          answer: "I searched the Supreme Court corpus, Indian Kanoon, and live legal sources but could not identify a reliable match. Try adding a statute name, section number, doctrine, or one known case name.",
          citations: [],
        }, 200, origin);
      }
      const webContext = webCases.map((c: unknown, i: number) => `[${i + 1}] ${c.title ?? "Result"}\nURL: ${c.url}\nExcerpt: ${c.content ?? ""}`).join("\n\n---\n\n");
      let wj: unknown;
      try {
        wj = await chatCompletion(GOOGLE_AI_API_KEY, {
          model: MODELS.FLASH,
          messages: [
            { role: "system", content: "You are Weybre AI, a legal research assistant for Indian lawyers. Answer from live legal search results only with [n] citations. Never invent cases." },
            { role: "user", content: `QUESTION: ${query}\n\nLIVE RESULTS:\n\n${webContext}` },
          ],
        });
      } catch (aiErr: unknown) {
        return json({ error: aiErr.message ?? "AI synthesis failed" }, aiErr.status ?? 500, origin);
      }
      return json({
        answer: wj.choices?.[0]?.message?.content ?? "No answer generated.",
        citations: webCases.map((c: unknown, i: number) => {
          let court = "";
          try { court = new URL(c.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
          return {
            n: i + 1, kind: "web", id: c.url, title: c.title ?? "Live source",
            court, headnote: c.content ?? null, url: c.url,
          };
        }),
      }, 200, origin);
    }

    // ---------- 4. Build grounded structured prompt ----------
    const context = ranked.map((s) => {
      const cite = s.neutral_citation || s.citation || (s.kind === "kanoon" ? `Indian Kanoon doc ${s.id}` : `Case ${s.n}`);
      const meta = [s.court, s.bench, s.decision_date].filter(Boolean).join(" | ");
      const authority = s.kind === "internal" ? "SC Corpus" : `Indian Kanoon${s.cited_by ? ` (cited ${s.cited_by}×)` : ""}`;
      return `[${s.n}] ${s.title}
Citation: ${cite}
Source authority: ${authority} | ${meta || "—"}
${s.headnote ? `Excerpt: ${s.headnote.slice(0, 1500)}` : ""}
${s.summary ? `Summary: ${s.summary.slice(0, 600)}` : ""}`;
    }).join("\n\n---\n\n");

    // Format Supermemory context
    const smProfile = smContext.profile
      ? `USER PROFILE & PREFERENCES:\n${smContext.profile.static.join("\n")}\n${smContext.profile.dynamic.join("\n")}`
      : "";
    const smMemories = smContext.searchResults?.results.length
      ? `PAST FIRM KNOWLEDGE / RELEVANT MEMORIES:\n${smContext.searchResults.results.map((r) => r.memory || r.chunk).join("\n---\n")}`
      : "";

    const systemPrompt = `You are Weybre AI, an Indian legal research engine. Synthesise grounded answers from CONTEXT (Supreme Court of India corpus + Indian Kanoon precedents) for practising advocates.

Write like a senior advocate briefing a colleague — clear prose, minimal scaffolding.

Format rules (important):
- Plain prose paragraphs by default. No headings, no bold, no horizontal rules, no decorative markdown.
- Use a short bullet list ONLY when listing 3+ discrete precedents or steps. Otherwise write paragraphs.
- Never use ##, ###, **bold**, *** or emoji.
- Inline [n] citations for every legal proposition, matching CONTEXT numbering.

Content:
- Open with a 2-3 sentence direct answer.
- Then a paragraph on the governing principles / sections / articles.
- Then the strongest precedents — ranked authority first (Constitution Bench > larger bench > recent SC > HC), each in one tight sentence with [n] and how it applies.
- Briefly quote or paraphrase the 1-3 most useful passages, tagged [n], ≤ 40 words each.
- Close with caveats (distinguishing facts, amendments, jurisdiction).

Hard rules:
- Never invent cases, citations or sections not in CONTEXT. If CONTEXT doesn't answer, say so plainly.
- Indian legal vocabulary (Section, Article, lakh, Hon'ble, ratio, obiter).
- Don't give legal advice; frame as "the Supreme Court has held…".
- Total length ≤ 450 words.`;

    const userDocsBlock = userDocs.length
      ? `\n\nUSER-PROVIDED DOCUMENTS (treat as the user's own facts/briefs/exhibits — anchor analysis to these and cite as [U1], [U2]…):\n\n${userDocs.map((d, i) => `[U${i + 1}] ${d.name}\n${d.text}`).join("\n\n---\n\n")}\n`
      : "";

    const smBlock = (smProfile || smMemories)
      ? `\n\nFIRM MEMORY & USER CONTEXT (use this to tailor the answer to the lawyer's preferences or previous firm research, but prioritize the official CONTEXT for legal authority):\n${smProfile}\n${smMemories}\n`
      : "";

    const userPrompt = `QUESTION: ${query}${userDocsBlock}${smBlock}\n\nCONTEXT (ranked Indian precedents):\n\n${context}\n\nWhen user documents are provided, frame the answer around their facts, then map the precedents to those facts. Use [n] for precedents and [U#] for user documents.`;

    // ---------- 5. Synthesize ----------
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
      return json({ error: aiErr.message ?? "AI synthesis failed" }, aiErr.status ?? 500, origin);
    }
    const answer = j.choices?.[0]?.message?.content ?? "No answer generated.";

    const citations = ranked.map((s) => ({
      n: s.n,
      kind: s.kind,
      id: s.id,
      title: s.title,
      citation: s.neutral_citation || s.citation,
      court: s.court,
      decision_date: s.decision_date,
      bench: s.bench,
      judges: s.judges,
      headnote: s.headnote,
      summary: s.summary,
      url: s.url,
      cited_by: s.cited_by ?? null,
      similarity: s.similarity ?? null,
    }));

    // Store the interaction in Supermemory (fire-and-forget)
    if (orgId) {
      addSupermemory(orgId, user.id, `User query: ${query}\nWeybre AI Answer: ${answer.slice(0, 1000)}`).catch(console.error);
    }

    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "research_query",
      tokens: j.usage?.total_tokens ?? 0,
      metadata: { query, matter_id, internal: internal.length, kanoon: ikDocs.length, ranked: ranked.length, user_docs: userDocs.length },
    });

    // Audit data access (best-effort, scoped to user's first org if any)
    try {
      if (orgId) {
        await admin.from("audit_logs").insert({
          organization_id: orgId,
          actor_user_id: user.id,
          actor_email: user.email,
          action: "data.research_query",
          resource_type: "research",
          metadata: { query: String(query).slice(0, 500), matter_id: matter_id ?? null, results: ranked.length },
        });
      }
    } catch (e) { console.error("audit research error", e); }

    return json({ answer, citations, credits_remaining: creditCheck.remaining }, 200, origin);
  } catch (e) {
    console.error("research error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
});

