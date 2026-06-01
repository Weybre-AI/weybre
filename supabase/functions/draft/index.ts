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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
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
      `- ${c.title} (${c.neutral_citation || c.citation || "—"}): ${(c.headnote ?? c.summary ?? "").slice(0, 400)}`
    ).join("\n");

    const systemPrompt = `You are Weybre AI, an Indian legal drafting assistant. Generate professional, courtroom-ready drafts for Indian lawyers.

TEMPLATE: ${template}
GUIDE: ${TEMPLATE_GUIDES[template]}

RELEVANT SUPREME COURT PRECEDENTS (use to inform risk flags):
${groundContext || "(none retrieved)"}

UPLOADED SOURCE DOCUMENTS (use first when drafting/reviewing; cite filename in suggestions):
${attachmentContext || "(none uploaded)"}

RULES:
1. Generate the FULL document in plain text with proper Indian legal formatting (numbered clauses, ALL CAPS for headings, "WHEREAS" recitals where appropriate).
2. Use Indian Rupees (₹), Indian dates (DD-MM-YYYY), Indian addresses, GST where relevant.
3. If the user has not provided enough information, ask 1-3 specific follow-up questions in your reply, but STILL generate a best-effort draft with [PLACEHOLDER] markers.
4. Identify risk_flags for clauses that could be unenforceable, ambiguous, or carry liability — especially under Section 27 ICA (restraint of trade), Section 23 ICA (public policy), DPDP Act 2023, Stamp Act requirements, registration requirements.
5. When uploaded documents are present, act as a document review assistant too: summarize the document, identify missing clauses, risky language, inconsistencies, enforceability problems, and propose precise replacement wording. Do not invent terms that are not in the uploaded text.

Return ONLY a JSON object via the function tool, no prose.`;

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

    let parsed: { reply: string; content: string; risk_flags: unknown[] };
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { return json({ error: "Invalid AI output" }, 500, origin); }

    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "draft_generation",
      tokens: j.usage?.total_tokens ?? 0,
      metadata: { template, title },
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
    } catch (e) { console.error("audit draft error", e); }

    return json(parsed, 200, origin);
  } catch (e) {
    console.error("draft error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
});
