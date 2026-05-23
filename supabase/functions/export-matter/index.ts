// deploy: 20260523140000
// Export a matter (research notes + draft list) to PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const { matter_id } = await req.json();
    if (!matter_id) return json({ error: "matter_id required" }, 400, origin);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: matter } = await admin
      .from("matters")
      .select("name, client, area, description, created_at")
      .eq("id", matter_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!matter) return json({ error: "Matter not found" }, 404, origin);

    const [{ data: notes }, { data: drafts }] = await Promise.all([
      admin
        .from("research_notes")
        .select("query, answer, citations, created_at")
        .eq("matter_id", matter_id)
        .order("created_at", { ascending: true }),
      admin
        .from("drafts")
        .select("title, template, status, updated_at")
        .eq("matter_id", matter_id)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    const writeLine = (text: string, opts: { font?: "bold" | "normal"; size?: number; gap?: number } = {}) => {
      doc.setFont("times", opts.font ?? "normal");
      doc.setFontSize(opts.size ?? 11);
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        if (y > pageH - margin - 20) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += (opts.size ?? 11) + 4;
      }
      y += opts.gap ?? 6;
    };

    writeLine(matter.name, { font: "bold", size: 20, gap: 8 });
    if (matter.client) writeLine(`Client: ${matter.client}`);
    if (matter.area) writeLine(`Area of practice: ${matter.area}`);
    if (matter.description) writeLine(matter.description);
    y += 12;

    writeLine("RESEARCH NOTES", { font: "bold", size: 14, gap: 8 });
    if (!notes || notes.length === 0) writeLine("(no research notes saved)", { gap: 12 });
    else {
      notes.forEach((n: { query: string; answer: string; citations?: unknown[] }, i: number) => {
        writeLine(`${i + 1}. ${n.query}`, { font: "bold", gap: 4 });
        writeLine(n.answer, { gap: 4 });
        const cites = (n.citations ?? []) as { n?: number; citation?: string; title?: string }[];
        if (cites.length) {
          writeLine(
            "Cited cases: " + cites.map((c) => `[${c.n}] ${c.citation || c.title}`).join("; "),
            { size: 9, gap: 12 },
          );
        } else y += 8;
      });
    }

    writeLine("DRAFTS IN THIS MATTER", { font: "bold", size: 14, gap: 8 });
    if (!drafts || drafts.length === 0) writeLine("(no drafts)");
    else drafts.forEach((d: { title: string; template: string; status: string }) =>
      writeLine(`• ${d.title} — ${d.template} (${d.status})`)
    );

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Weybre AI · Matter export · Page ${i} of ${pages}`, pageW / 2, pageH - 24, { align: "center" });
      doc.setTextColor(0);
    }

    const bytes = new Uint8Array(doc.output("arraybuffer"));
    return json({ file: bytesToBase64(bytes), filename: `${matter.name}.pdf` }, 200, origin);
  } catch (e) {
    console.error("export-matter error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
});
