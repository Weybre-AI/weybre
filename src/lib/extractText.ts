import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth/mammoth.browser";
import { invokeFunction } from "@/lib/invokeFunction";
import { type PDFPageProxy, type TextItem } from "pdfjs-dist/types/src/display/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_CHARS = 60_000;
const MAX_OCR_PAGES = 10;
const OCR_TRIGGER_CHARS_PER_PAGE = 80; // if native extraction yields less, fall back to OCR

// Heuristic: detect Indic / non-Latin scripts; native pdf.js sometimes mangles ligatures.
function looksLikeMojibake(s: string): boolean {
  if (!s) return true;
  const total = s.length;
  if (total < 40) return true;
  const replacement = (s.match(/\uFFFD/g) ?? []).length;
  if (replacement / total > 0.02) return true;
  // Mostly whitespace / control chars?
  const printable = (s.match(/[\p{L}\p{N}]/gu) ?? []).length;
  return printable / total < 0.3;
}

async function pdfPageToPng(page: PDFPageProxy, scale = 1.6): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

async function ocrImages(images: string[], languageHint = "auto"): Promise<string> {
  if (images.length === 0) return "";
  const { data, error } = await invokeFunction<{ text?: string }>("vision-ocr", {
    body: { images, languageHint },
  });
  if (error) throw new Error(error);
  return String(data?.text ?? "");
}

export interface ExtractOptions {
  /** Try multilingual OCR fallback when native extraction looks weak. Default true. */
  ocrFallback?: boolean;
  /** ISO language hint for OCR (e.g. "hi", "ta", "auto"). */
  languageHint?: string;
  /** Called with status updates for UX. */
  onProgress?: (msg: string) => void;
}

export async function extractTextFromFile(file: File, opts: ExtractOptions = {}): Promise<string> {
  const { ocrFallback = true, languageHint = "auto", onProgress } = opts;
  const type = file.type;

  // Plain text-ish
  if (type === "text/plain" || type === "text/markdown" || type === "application/rtf") {
    return (await file.text()).slice(0, MAX_CHARS);
  }

  // DOCX
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.slice(0, MAX_CHARS);
  }

  // Image — straight to OCR
  if (type.startsWith("image/")) {
    onProgress?.("Running multilingual OCR…");
    const reader = new FileReader();
    const dataUrl: string = await new Promise((res, rej) => {
      reader.onload = () => res(String(reader.result));
      reader.onerror = () => rej(reader.error);
      reader.readAsDataURL(file);
    });
    return (await ocrImages([dataUrl], languageHint)).slice(0, MAX_CHARS);
  }

  // PDF
  if (type === "application/pdf") {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pageCount = Math.min(pdf.numPages, 80);
    const pages: string[] = [];
    for (let n = 1; n <= pageCount; n += 1) {
      const page = await pdf.getPage(n);
      const text = await page.getTextContent();
      pages.push(text.items.map((it) => (it as TextItem).str).join(" "));
    }
    const native = pages.join("\n\n").slice(0, MAX_CHARS);

    if (!ocrFallback) return native;

    const avg = native.length / Math.max(pageCount, 1);
    const needsOcr = avg < OCR_TRIGGER_CHARS_PER_PAGE || looksLikeMojibake(native);
    if (!needsOcr) return native;

    onProgress?.(`Native extraction sparse (${native.length} chars). Running multilingual OCR on first ${Math.min(pageCount, MAX_OCR_PAGES)} pages…`);
    const images: string[] = [];
    const ocrPages = Math.min(pageCount, MAX_OCR_PAGES);
    for (let n = 1; n <= ocrPages; n += 1) {
      const page = await pdf.getPage(n);
      images.push(await pdfPageToPng(page));
    }
    try {
      const ocrText = await ocrImages(images, languageHint);
      // If OCR succeeded, prefer it; keep native as appendix when partial.
      if (ocrText && ocrText.length > native.length * 0.6) return ocrText.slice(0, MAX_CHARS);
      return (ocrText + "\n\n--- native extraction ---\n\n" + native).slice(0, MAX_CHARS);
    } catch (e) {
      console.warn("OCR fallback failed, returning native text", e);
      return native;
    }
  }

  return "";
}
