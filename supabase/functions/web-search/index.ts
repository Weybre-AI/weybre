// deploy: 20260523120000
// Weybre AI — production web research with real Tavily search results + cited AI synthesis.
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
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
      console.error("Tavily error", search.status, t);
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

Write like a senior advocate briefing a colleague — clean prose, no scaffolding.
Format rules: no headings, no bold, no horizontal rules, no emoji. Plain paragraphs. Use a short bullet list only when listing 3+ discrete items.

Open with a 2-3 sentence direct answer. Continue with supporting detail in prose, every factual claim carrying an inline [n] citation matching the numbered sources. Close with a brief caveat on what to verify. End with one short line: "Verify before relying on this for filings."

Hard rules: never invent facts, statutes or case names. Prefer authoritative Indian sources (.gov.in, .nic.in, SC/HC sites, BCI, MoL, LiveLaw, Bar & Bench, SCC Online). Indian vocabulary (Section, Article, lakh/crore). Don't give legal advice — frame as "according to [source]…". Maximum 300 words.`;

    const sourceContext = sources.map((s) => `[${s.n}] ${s.title}\nURL: ${s.url}\nSource: ${s.domain}\nExcerpt: ${s.snippet ?? ""}`).join("\n\n---\n\n");
    const userDocsBlock = userDocs.length
      ? `\n\nUSER-PROVIDED DOCUMENTS (treat as authoritative background context — cite as [U1], [U2]… when used):\n\n${userDocs.map((d, i) => `[U${i + 1}] ${d.name}\n${d.text}`).join("\n\n---\n\n")}\n`
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
    console.error("web-search error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
});
