import { useState, useRef, useEffect, type ElementType } from "react";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { safeHref } from "@/lib/safeHref";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sparkles, BookOpen, Save, Loader2, ArrowUp, Globe, Scale, ExternalLink, Search, Download, Paperclip, X, FileText } from "lucide-react";
import { exportAiResultPdf } from "@/lib/exportPdf";
import { extractTextFromFile } from "@/lib/extractText";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type SearchMode = "case-law" | "web";

interface Citation {
  id: string;
  kind?: "internal" | "kanoon" | "web";
  title: string;
  citation?: string | null;
  neutral_citation?: string | null;
  court?: string | null;
  decision_date?: string | null;
  bench?: string | null;
  judges?: string[] | null;
  headnote?: string | null;
  summary?: string | null;
  url?: string | null;
  cited_by?: number | null;
  similarity?: number;
}

interface WebSource {
  n: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

const CASE_LAW_SAMPLES = [
  "When can specific performance be denied due to delay in approaching the court?",
  "Recent SC judgments on anticipatory bail under Section 438 CrPC",
  "Doctrine of frustration in commercial contracts post-COVID",
  "Burden of proof in matrimonial cruelty cases under Section 13(1)(ia) HMA",
];

const WEB_SAMPLES = [
  "Latest amendments to the Bharatiya Nyaya Sanhita 2023",
  "Current Supreme Court Collegium recommendations",
  "DPDP Act 2023 — implementation rules notified so far",
  "GST rate changes for legal services in 2025",
];

const PROGRESS_STEPS_CASE = [
  "Searching SC corpus + Indian Kanoon in parallel…",
  "Ranking precedents by authority, citations, and relevance…",
  "Extracting principles, key paragraphs, and caveats…",
];

const PROGRESS_STEPS_WEB = [
  "Querying live web sources…",
  "Filtering for authoritative Indian legal sources…",
  "Extracting citations and synthesising answer…",
];

const Research = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<SearchMode>("case-law");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [webSources, setWebSources] = useState<WebSource[]>([]);
  const [resultMode, setResultMode] = useState<SearchMode>("case-law");
  const [showSave, setShowSave] = useState(false);
  const [matters, setMatters] = useState<{ id: string; name: string }[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<string>("");
  const [newMatterName, setNewMatterName] = useState("");
  const [saving, setSaving] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type Attachment = { id: string; name: string; size: number; status: "extracting" | "ready" | "error"; text: string; error?: string };
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const ALLOWED_RESEARCH_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "text/markdown", "application/rtf",
    "image/png", "image/jpeg", "image/jpg", "image/webp",
  ];
  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).slice(0, 5);
    for (const f of incoming) {
      if (!ALLOWED_RESEARCH_TYPES.includes(f.type)) {
        toast.error(`Unsupported file: ${f.name}`, { description: "PDF, DOCX, TXT, or image only." });
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`Too large: ${f.name}`, { description: "Max 10MB per file." });
        continue;
      }
      const id = crypto.randomUUID();
      setAttachments(prev => [...prev, { id, name: f.name, size: f.size, status: "extracting", text: "" }]);
      try {
        const text = await extractTextFromFile(f, { ocrFallback: true });
        if (!text.trim()) throw new Error("No readable text extracted");
        setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: "ready", text } : a));
      } catch (e: unknown) {
        setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: "error", error: e?.message ?? "Extract failed" } : a));
        toast.error(`Couldn't read ${f.name}`, { description: e?.message ?? "Try another file." });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  useEffect(() => {
    if (!user) return;
    supabase.from("matters").select("id,name").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setMatters(data ?? []));
  }, [user]);

  // Animated progress steps while loading
  useEffect(() => {
    if (!loading) return;
    setProgressStep(0);
    const steps = mode === "web" ? PROGRESS_STEPS_WEB : PROGRESS_STEPS_CASE;
    const interval = setInterval(() => {
      setProgressStep(s => Math.min(s + 1, steps.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [loading, mode]);

  const handleAsk = async (q?: string, overrideMode?: SearchMode) => {
    const text = (q ?? query).trim();
    if (!text) return;
    const activeMode = overrideMode ?? mode;
    setQuery(text);
    setLoading(true);
    setAnswer("");
    setCitations([]);
    setWebSources([]);
    setResultMode(activeMode);

    try {
      const userContext = attachments
        .filter(a => a.status === "ready" && a.text.trim().length > 0)
        .map(a => ({ name: a.name, text: a.text }));
      if (activeMode === "case-law") {
        const { data, error } = await invokeFunction<{ answer?: string; citations?: Citation[]; error?: string }>(
          "research",
          { body: { query: text, userContext } },
        );
        if (error) throw error;
        setAnswer(data?.answer ?? "");
        setCitations(data?.citations ?? []);
      } else {
        const { data, error } = await invokeFunction<{ answer?: string; sources?: WebSource[]; error?: string }>(
          "web-search",
          { body: { query: text, userContext } },
        );
        if (error) throw error;
        setAnswer(data?.answer ?? "");
        setWebSources(data?.sources ?? []);
      }
    } catch (err: unknown) {
      const msg = err?.message ?? "Research failed";
      if (msg.includes("rate") || msg.includes("429")) {
        toast.error("AI is busy", { description: "Please retry in a moment." });
      } else if (msg.includes("402") || msg.toLowerCase().includes("payment") || msg.toLowerCase().includes("credits")) {
        toast.error("AI credits exhausted", { description: "Add credits in Settings → Workspace → Usage." });
      } else {
        toast.error("Research failed", { description: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!user || !answer) return;
    setSaving(true);
    let matterId = selectedMatter;
    if (!matterId && newMatterName.trim()) {
      const { data, error } = await supabase.from("matters").insert({
        user_id: user.id, name: newMatterName.trim(),
      }).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      matterId = data.id;
    }
    const citationsPayload = resultMode === "case-law" ? citations : webSources;
    const { error } = await supabase.from("research_notes").insert({
      user_id: user.id,
      matter_id: matterId || null,
      query,
      answer,
      citations: citationsPayload as unknown,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Saved to matter");
    setShowSave(false);
    setNewMatterName("");
    setSelectedMatter("");
    setSaving(false);
  };

  const renderAnswer = (txt: string) => {
    const parts = txt.split(/(\[\d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[(\d+)\]$/);
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        const target =
          resultMode === "case-law" ? citations[idx] : webSources[idx];
        return (
          <button
            key={i}
            onClick={() => document.getElementById(`cite-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="citation-chip mx-0.5 align-baseline"
            title={(target as unknown)?.title ?? `Source ${m[1]}`}
          >
            [{m[1]}]
          </button>
        );
      }
      return <span key={i}>{p}</span>;
    });
  };

  const samples = mode === "web" ? WEB_SAMPLES : CASE_LAW_SAMPLES;
  const placeholder = mode === "web"
    ? "e.g. Latest Supreme Court ruling on electoral bonds, or status of the Mediation Act 2023…"
    : "e.g. Can a contract be specifically enforced when the plaintiff has delayed approaching the court?";
  const progressSteps = resultMode === "web" ? PROGRESS_STEPS_WEB : PROGRESS_STEPS_CASE;

  return (
    <AppShell title="Research">
      <div className="container max-w-3xl px-4 py-6 sm:py-12">
        {/* Welcome — only when no answer yet */}
        {!answer && !loading && (
          <div className="mb-8 text-center">
            <h2 className="font-serif text-4xl font-semibold tracking-tight text-primary md:text-5xl">
              What can I help you research?
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Cited answers from the Indian Supreme Court corpus and the live web.
            </p>
          </div>
        )}

        {/* Mode selector */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as SearchMode)} className="mb-4 flex justify-center">
          <TabsList className="grid w-full max-w-xs grid-cols-2 rounded-full bg-secondary p-1">
            <TabsTrigger value="case-law" className="gap-2 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Scale className="h-3.5 w-3.5" /> Case law
            </TabsTrigger>
            <TabsTrigger value="web" className="gap-2 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Globe className="h-3.5 w-3.5" /> Web
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ask box — Perplexity-style rounded surface */}
        <div className="px-ask p-5">
          <Textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="min-h-[88px] resize-none border-0 bg-transparent p-0 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk(); }}
          />

          {/* Attached docs */}
          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {attachments.map(a => (
                <span
                  key={a.id}
                  className={`inline-flex max-w-[260px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    a.status === "error"
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-border bg-secondary text-foreground"
                  }`}
                  title={a.status === "error" ? a.error : a.name}
                >
                  {a.status === "extracting"
                    ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
                    : <FileText className="h-3 w-3 shrink-0 text-accent" />}
                  <span className="truncate">{a.name}</span>
                  {a.status === "ready" && (
                    <span className="font-mono text-[0.6rem] text-muted-foreground">
                      {Math.max(1, Math.round(a.text.length / 1000))}k
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    aria-label={`Remove ${a.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={e => handleFilesSelected(e.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleAttachClick}
                className="h-8 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                title="Attach your own documents (PDF, DOCX, image)"
              >
                <Paperclip className="h-3.5 w-3.5" /> Attach
              </Button>
              <span className="px-section-label truncate">
                {mode === "web" ? <Globe className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {attachments.some(a => a.status === "ready")
                  ? `Grounded on ${attachments.filter(a => a.status === "ready").length} document${attachments.filter(a => a.status === "ready").length === 1 ? "" : "s"}`
                  : (mode === "web" ? "AI web search · cited live sources" : "Indian SC corpus · cited")}
              </span>
            </div>
            <Button
              onClick={() => handleAsk()}
              disabled={loading || !query.trim() || attachments.some(a => a.status === "extracting")}
              size="sm"
              className="rounded-full bg-primary px-4 hover:bg-primary-glow"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              {mode === "web" ? "Search" : "Ask"}
            </Button>
          </div>
        </div>

        {/* Sample queries — pill chips */}
        {!answer && !loading && (
          <div className="mt-8">
            <p className="px-section-label mb-3 justify-center w-full text-center">
              Try a sample {mode === "web" ? "web search" : "case-law query"}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {samples.map(s => (
                <button key={s} onClick={() => handleAsk(s)} className="px-pill">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning state — animated, multi-step */}
        {loading && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="px-section-label">
                {mode === "web" ? "Searching the web…" : "Searching case law…"}
              </span>
            </div>
            <ol className="space-y-2 pl-1">
              {progressSteps.map((step, i) => {
                const done = i < progressStep;
                const active = i === progressStep;
                return (
                  <li key={step} className={`flex items-center gap-2.5 text-sm transition-opacity ${done || active ? "opacity-100" : "opacity-40"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${done ? "border-accent bg-accent text-accent-foreground" : active ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{step}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Answer */}
        {answer && !loading && (
          <div ref={answerRef} className="mt-10 animate-fade-in">
            {/* Query echo */}
            <h3 className="mb-6 font-serif text-2xl font-semibold leading-snug text-primary">{query}</h3>

            {/* Sources strip — progressive disclosure */}
            {((resultMode === "case-law" && citations.length > 0) || (resultMode === "web" && webSources.length > 0)) && (
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" />
                  <span className="px-section-label">Sources</span>
                  <span className="text-xs text-muted-foreground">
                    · {resultMode === "case-law" ? citations.length : webSources.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {(resultMode === "case-law" ? citations : webSources).slice(0, 4).map((s: unknown, i) => (
                    <button
                      key={i}
                      onClick={() => document.getElementById(`cite-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-accent/40 hover:shadow-sm"
                    >
                      <div className="mb-1 flex items-center gap-1 font-mono text-[0.65rem] text-muted-foreground">
                        <span className="rounded bg-accent-soft px-1 text-accent-foreground">[{i + 1}]</span>
                        <span className="truncate">{resultMode === "web" ? s.domain : s.neutral_citation || "Judgment"}</span>
                      </div>
                      <p className="line-clamp-2 text-xs font-medium text-foreground">{s.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Answer */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="px-section-label">Answer</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                  {resultMode === "web" ? <Globe className="h-2.5 w-2.5" /> : <Scale className="h-2.5 w-2.5" />}
                  {resultMode === "web" ? "Web" : "Case law"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    exportAiResultPdf({
                      title: query || "Weybre AI research",
                      subtitle: resultMode === "web" ? "Web research" : "Case-law research",
                      query,
                      body: answer,
                      sources: (resultMode === "case-law" ? citations : webSources).map((s: unknown, i) => ({
                        n: i + 1,
                        title: s.title,
                        url: s.url,
                        citation: s.citation,
                        neutral_citation: s.neutral_citation,
                        court: s.court,
                        decision_date: s.decision_date,
                        domain: s.domain,
                        cited_by: s.cited_by,
                      })),
                    })
                  }
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSave(true)}>
                  <Save className="h-4 w-4" /> Save
                </Button>
              </div>
            </div>

            <article className="prose-px font-serif text-[1.05rem] leading-[1.75] text-foreground">
              {answer.split("\n\n").map((para, i) => (
                <p key={i} className="mb-4 last:mb-0">{renderAnswer(para)}</p>
              ))}
            </article>

            <div className="my-6"><AiDisclaimer /></div>

            {/* Detailed citations */}
            {resultMode === "case-law" && citations.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" />
                  <span className="px-section-label">Cited judgments</span>
                </div>
                <div className="space-y-3">
                  {citations.map((c, i) => {
                    const kanoonUrl = c.kind === "kanoon" ? safeHref(c.url) : null;
                    const Wrapper: ElementType = kanoonUrl ? "a" : "div";
                    const wrapperProps = kanoonUrl
                      ? { href: kanoonUrl, target: "_blank", rel: "noopener noreferrer", className: "group block rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent/40" }
                      : { className: "rounded-xl border border-border bg-card p-5" };
                    return (
                      <Wrapper key={c.id ?? i} id={`cite-${i}`} {...wrapperProps}>
                        <div className="mb-1 flex items-start justify-between gap-3">
                          <h4 className="font-serif text-base font-semibold text-primary group-hover:text-accent">
                            [{i + 1}] {c.title}
                          </h4>
                          <div className="flex shrink-0 items-center gap-2 font-mono text-[0.7rem] text-muted-foreground">
                            {c.cited_by ? <span title="Times cited">cited {c.cited_by}×</span> : null}
                            {c.similarity != null && c.kind === "internal" && <span>{(c.similarity * 100).toFixed(0)}% match</span>}
                            {kanoonUrl && <ExternalLink className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] text-muted-foreground">
                          <span className="rounded bg-accent-soft px-1 text-accent-foreground">{c.kind === "kanoon" ? "Indian Kanoon" : "SC corpus"}</span>
                          {c.neutral_citation && <span>{c.neutral_citation}</span>}
                          {c.citation && <span>· {c.citation}</span>}
                          {c.court && !c.neutral_citation && <span>· {c.court}</span>}
                          {c.decision_date && <span>· {new Date(c.decision_date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</span>}
                          {c.bench && <span>· {c.bench}</span>}
                        </div>
                        {c.headnote && <p className="text-sm leading-relaxed text-muted-foreground">{c.headnote}</p>}
                      </Wrapper>
                    );
                  })}
                </div>
              </div>
            )}

            {resultMode === "web" && webSources.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-accent" />
                  <span className="px-section-label">Web sources</span>
                </div>
                <div className="space-y-3">
                  {webSources.map((s, i) => {
                    const url = safeHref(s.url);
                    if (!url) return null;
                    return (
                      <a key={`${s.url}-${i}`} id={`cite-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="group block rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent/40">
                        <div className="mb-1 flex items-start justify-between gap-3">
                          <h4 className="font-serif text-base font-semibold text-primary group-hover:text-accent">[{i + 1}] {s.title}</h4>
                          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mb-2 font-mono text-[0.7rem] text-muted-foreground">{s.domain}</div>
                        {s.snippet && <p className="text-sm leading-relaxed text-muted-foreground">{s.snippet}</p>}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {resultMode === "web" && webSources.length === 0 && (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
                <Search className="mb-1 inline h-3.5 w-3.5" /> No structured sources returned. Verify the answer above before relying on it.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Save research note</DialogTitle>
            <DialogDescription>Attach this answer to an existing matter or create a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {matters.length > 0 && (
              <div className="space-y-1.5">
                <Label>Existing matter</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedMatter}
                  onChange={e => { setSelectedMatter(e.target.value); setNewMatterName(""); }}
                >
                  <option value="">— choose —</option>
                  {matters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Or create new matter</Label>
              <Input value={newMatterName} onChange={e => { setNewMatterName(e.target.value); setSelectedMatter(""); }} placeholder="e.g. Sharma v. Mehta — specific performance" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSave(false)}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={saving || (!selectedMatter && !newMatterName.trim())}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Research;
