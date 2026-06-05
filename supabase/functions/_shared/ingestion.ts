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
