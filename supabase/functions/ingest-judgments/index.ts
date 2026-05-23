// deploy: 20260522151723
// Admin-only ingestion endpoint. Supports two modes:
//  1) source:"rows" (default) — accepts a small batch of pre-built rows.
//  2) source:"hf" — streams rows from the Hugging Face Datasets Server
//     (Hibbaan/indian-case-laws by default), normalizes, optionally embeds,
//     and upserts on external_id. Resumable via { offset }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { embed as googleEmbed } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY")!;
const HF_API = "https://datasets-server.huggingface.co";

interface InRow {
  external_id?: string;
  title: string;
  citation?: string;
  neutral_citation?: string;
  court?: string;
  bench?: string;
  judges?: string[];
  decision_date?: string | null;
  disposition?: string;
  headnote?: string;
  summary?: string;
  full_text?: string;
  source_url?: string;
}

async function embed(text: string): Promise<number[] | null> {
  return googleEmbed(GOOGLE_AI_API_KEY, text);
}

function safeDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function mapHfRow(raw: any): InRow {
  const r = raw?.row ?? raw;
  return {
    external_id: r.case_metadata_id ?? null,
    title: r.case_title ?? r.party_caption ?? r.docket_number ?? "Untitled judgment",
    citation: r.law_report_citation ?? null,
    neutral_citation: r.neutral_citation ?? null,
    court: r.court_name ?? "Indian Court",
    bench: r.bench_name ?? null,
    judges: Array.isArray(r.coram_members) && r.coram_members.length ? r.coram_members : null,
    decision_date: safeDate(r.decision_date),
    disposition: r.disposition_text ?? null,
    headnote: r.headnote_text ?? null,
    summary: r.headnote_text ?? null,
    full_text: r.indexable_text ?? null,
    source_url: r.source_pdf_s3_url ?? r.source_json_s3_url ?? null,
  };
}

async function upsertOne(admin: any, row: InRow, withEmbed: boolean) {
  let vec: number[] | null = null;
  if (withEmbed) {
    const text = [row.title, row.headnote, row.summary, row.full_text].filter(Boolean).join("\n\n");
    vec = await embed(text || row.title);
  }
  const record: any = {
    external_id: row.external_id ?? null,
    title: row.title,
    citation: row.citation ?? null,
    neutral_citation: row.neutral_citation ?? null,
    court: row.court ?? "Indian Court",
    bench: row.bench ?? null,
    judges: row.judges ?? null,
    decision_date: row.decision_date ?? null,
    disposition: row.disposition ?? null,
    headnote: row.headnote ?? null,
    summary: row.summary ?? null,
    full_text: row.full_text ?? null,
    source_url: row.source_url ?? null,
    embedding: vec ? `[${vec.join(",")}]` : null,
  };
  if (row.external_id) {
    const { error } = await admin.from("judgments").upsert(record, { onConflict: "external_id" });
    if (error) return { ok: false, error: error.message, external_id: row.external_id };
    return { ok: true, external_id: row.external_id, embedded: !!vec };
  }
  const { error } = await admin.from("judgments").insert(record);
  if (error) return { ok: false, error: error.message };
  return { ok: true, embedded: !!vec };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const caller = await getUser(auth);
    if (!caller) return json({ error: "Unauthorized" }, 401, origin);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403, origin);

    const body = await req.json().catch(() => ({}));
    const source = (body.source as string) ?? "rows";

    if (source === "hf") {
      const dataset = body.dataset ?? "Hibbaan/indian-case-laws";
      const config = body.config ?? "default";
      const split = body.split ?? "train";
      const offset = Math.max(0, Number(body.offset ?? 0));
      const limit = Math.min(100, Math.max(1, Number(body.limit ?? 50)));
      const withEmbed = body.embed === true; // default false (cost guard at 17M rows)

      const u = new URL(`${HF_API}/rows`);
      u.searchParams.set("dataset", dataset);
      u.searchParams.set("config", config);
      u.searchParams.set("split", split);
      u.searchParams.set("offset", String(offset));
      u.searchParams.set("length", String(limit));

      const hfRes = await fetch(u.toString());
      if (!hfRes.ok) {
        const t = await hfRes.text();
        return json({ error: `HF fetch failed [${hfRes.status}]: ${t.slice(0, 500)}` }, 502, origin);
      }
      const hfJson = await hfRes.json();
      const rawRows: any[] = hfJson.rows ?? [];
      const results: any[] = [];
      for (const raw of rawRows) {
        const row = mapHfRow(raw);
        results.push(await upsertOne(admin, row, withEmbed));
      }
      const nextOffset = offset + rawRows.length;
      const total = hfJson.num_rows_total ?? null;
      return json({
        source: "hf", dataset, config, split,
        processed: results.length, offset, next_offset: nextOffset, total,
        embedded: withEmbed,
        ok: results.filter(r => r.ok).length,
        failed: results.filter(r => !r.ok).length,
        sample_errors: results.filter(r => !r.ok).slice(0, 3),
      }, 200, origin);
    }

    // legacy rows mode
    const { rows } = body as { rows: InRow[] };
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "rows[] required" }, 400, origin);
    if (rows.length > 20) return json({ error: "Max 20 rows per batch" }, 400, origin);

    const out: any[] = [];
    for (const row of rows) out.push(await upsertOne(admin, row, true));
    return json({ processed: out.length, results: out }, 200, origin);
  } catch (e) {
    console.error("ingest", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
});
