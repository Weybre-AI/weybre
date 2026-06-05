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
