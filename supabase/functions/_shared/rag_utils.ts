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
