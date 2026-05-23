import { jsPDF } from "jspdf";

export interface PdfSource {
  n?: number;
  title?: string;
  url?: string | null;
  citation?: string | null;
  neutral_citation?: string | null;
  court?: string | null;
  source?: string | null;
  date?: string | null;
  decision_date?: string | null;
  domain?: string | null;
  cited_by?: number | null;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  query?: string;
  body: string;
  sources?: PdfSource[];
  filename?: string;
}

/**
 * Generates a clean A4 PDF for AI outputs (research, litigation, decision).
 * Strips markdown scaffolding so the PDF reads as plain advocate-style prose.
 */
export function exportAiResultPdf(opts: PdfExportOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Brand header
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 30, 60);
  doc.text("Weybre AI", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString("en-IN"), pageW - margin, y, { align: "right" });
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  // Title
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 30, 60);
  const titleLines = doc.splitTextToSize(opts.title, contentW);
  ensureSpace(titleLines.length * 20);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 20;

  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(opts.subtitle, margin, y);
    y += 16;
  }

  if (opts.query) {
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(80);
    const qLines = doc.splitTextToSize(`Query: ${opts.query}`, contentW);
    ensureSpace(qLines.length * 13 + 6);
    doc.text(qLines, margin, y);
    y += qLines.length * 13 + 8;
  }

  y += 6;

  // Body — treat as prose; preserve paragraph breaks; render bullets as "• "
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30);

  const cleaned = opts.body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^---+$/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();

  for (const para of cleaned.split(/\n{2,}/)) {
    const block = para.trim();
    if (!block) continue;
    for (const line of block.split("\n")) {
      const wrapped = doc.splitTextToSize(line, contentW);
      ensureSpace(wrapped.length * 14);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 14;
    }
    y += 8;
  }

  // Sources
  if (opts.sources && opts.sources.length) {
    y += 8;
    ensureSpace(30);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 30, 60);
    doc.text("Sources & citations", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40);

    opts.sources.forEach((s, i) => {
      const num = s.n ?? i + 1;
      const meta = [
        s.court ?? s.source ?? s.domain,
        s.neutral_citation ?? s.citation,
        s.decision_date ?? s.date,
        s.cited_by ? `cited ${s.cited_by}×` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const head = `[${num}] ${s.title ?? "Untitled"}`;
      const headLines = doc.splitTextToSize(head, contentW);
      ensureSpace(headLines.length * 13 + (meta ? 13 : 0) + (s.url ? 13 : 0) + 8);
      doc.setTextColor(30);
      doc.text(headLines, margin, y);
      y += headLines.length * 13;
      if (meta) {
        doc.setTextColor(110);
        const metaLines = doc.splitTextToSize(meta, contentW);
        doc.text(metaLines, margin, y);
        y += metaLines.length * 13;
      }
      if (s.url) {
        doc.setTextColor(60, 90, 180);
        const urlLines = doc.splitTextToSize(s.url, contentW);
        doc.text(urlLines, margin, y);
        y += urlLines.length * 13;
      }
      y += 6;
    });
  }

  // Footer disclaimer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "Verify before filing — AI-generated, not legal advice. © Weybre AI",
      margin,
      pageH - 24,
    );
    doc.text(`${p} / ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  const safeName = (opts.filename ?? opts.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "weybre-ai";
  doc.save(`${safeName}.pdf`);
}
