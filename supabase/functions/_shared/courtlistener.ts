import { requireEnv } from "./auth.ts";
import { logError } from "./logger.ts";

const CL_TOKEN = Deno.env.get("COURTLISTENER_API_TOKEN") ?? "";
const CL_BASE = "https://www.courtlistener.com/api/rest/v4";

/**
 * Weybre AI — CourtListener Integration
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
