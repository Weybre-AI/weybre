import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/safeHref";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Loader2, Sparkles, ExternalLink, Hash, Search, Upload, Bell, BellRing, Trash2,
  Gavel, Calendar, ScrollText, ListChecks, Download, Layers, FileSignature, CheckCircle2, AlertCircle,
} from "lucide-react";
import { exportAiResultPdf } from "@/lib/exportPdf";

type Mode = "cnr" | "keyword" | "document" | "batch";

interface Precedent {
  tid: number;
  title: string;
  source?: string;
  date?: string;
  cited_by?: number;
  headline?: string;
  url: string;
}

interface IntelResponse {
  mode: Mode;
  brief: string;
  court_data: Record<string, unknown> | null;
  precedents: Precedent[];
  live_cases: Record<string, unknown>[];
  query: string;
}

interface WatchItem {
  id: string;
  kind: "cnr" | "keyword" | "competitor" | "regulator";
  label: string;
  identifier: string;
  notes?: string | null;
  last_checked_at?: string | null;
  created_at: string;
}

const SAMPLES = {
  cnr: ["DLCT010012342024", "MHCT020045672023"],
  keyword: [
    "Specific performance denied for inordinate delay",
    "Anticipatory bail under Section 438 CrPC for 498A",
    "RERA refund with interest for builder delay",
  ],
  document: [
    "Paste a notice, petition, or order text to extract issues, precedents, and a strategy memo.",
  ],
};

interface BatchRow {
  cnr: string;
  status: "pending" | "running" | "done" | "error";
  title?: string;
  court?: string;
  next_hearing?: string;
  brief_excerpt?: string;
  fraud_signal?: string;
  error?: string;
}

const Litigation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("cnr");
  const [cnr, setCnr] = useState("");
  const [query, setQuery] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<IntelResponse | null>(null);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [batchInput, setBatchInput] = useState("");
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { loadWatch(); }, []);

  async function loadWatch() {
    const { data, error } = await supabase
      .from("litigation_watchlist")
      .select("id,kind,label,identifier,notes,last_checked_at,created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setWatch(data as WatchItem[]);
  }

  async function runIntel() {
    if (mode === "cnr" && cnr.trim().length === 0) {
      toast.error("Enter a 16-character CNR.");
      return;
    }
    if (mode === "keyword" && query.trim().length < 5) {
      toast.error("Describe the legal issue (min 5 chars).");
      return;
    }
    if (mode === "document" && documentText.trim().length < 100) {
      toast.error("Paste at least 100 characters of document text.");
      return;
    }
    setLoading(true);
    setIntel(null);
    try {
      const { data, error } = await supabase.functions.invoke("litigation-intel", {
        body: { mode, cnr, query, documentText },
      });
      if (error) throw error;
      if ((data as unknown)?.error) throw new Error((data as unknown).error);
      setIntel(data as IntelResponse);
    } catch (e: unknown) {
      toast.error(e?.message ?? "Intelligence engine failed");
    } finally {
      setLoading(false);
    }
  }

  async function trackCurrent() {
    if (!intel) return;
    const kind = intel.mode === "cnr" ? "cnr" : "keyword";
    const identifier = intel.mode === "cnr" ? cnr.toUpperCase() : (query || intel.query);
    const label =
      intel.mode === "cnr"
        ? (intel.court_data?.case?.title ?? intel.court_data?.title ?? `CNR ${identifier}`)
        : identifier.slice(0, 80);
    const { error } = await supabase.from("litigation_watchlist").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      kind, label, identifier,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Added to watchlist");
    loadWatch();
  }

  async function refreshWatch(item: WatchItem) {
    setRefreshing(item.id);
    try {
      const body =
        item.kind === "cnr"
          ? { mode: "cnr" as const, cnr: item.identifier }
          : { mode: "keyword" as const, query: item.identifier };
      const { data, error } = await supabase.functions.invoke("litigation-intel", { body });
      if (error) throw error;
      await supabase
        .from("litigation_watchlist")
        .update({
          last_checked_at: new Date().toISOString(),
          last_snapshot: { brief: (data as unknown)?.brief?.slice(0, 600), court_data: (data as unknown)?.court_data ?? null },
        })
        .eq("id", item.id);
      toast.success(`Refreshed: ${item.label}`);
      setIntel(data as IntelResponse);
      loadWatch();
    } catch (e: unknown) {
      toast.error(e?.message ?? "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  async function removeWatch(id: string) {
    await supabase.from("litigation_watchlist").delete().eq("id", id);
    setWatch(w => w.filter(x => x.id !== id));
  }

  function onFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("File too large. Use under 2 MB or paste the text below.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentText(String(reader.result ?? "").slice(0, 30000));
      setMode("document");
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }

  // ----- Batch CNR intake (parallel, max concurrency 4) -----
  function parseCnrs(raw: string): string[] {
    return Array.from(
      new Set(
        raw
          .split(/[\s,;\n\r]+/)
          .map(s => s.trim().toUpperCase())
          .filter(s => /^[A-Z]{4}\d{12}$/.test(s))
      )
    );
  }

  async function runBatch() {
    const cnrs = parseCnrs(batchInput);
    if (cnrs.length === 0) {
      toast.error("Paste one CNR per line (16 chars: 4 letters + 12 digits).");
      return;
    }
    if (cnrs.length > 50) {
      toast.error("Limit 50 CNRs per batch. Split into smaller runs.");
      return;
    }
    const initial: BatchRow[] = cnrs.map(c => ({ cnr: c, status: "pending" }));
    setBatchRows(initial);
    setBatchRunning(true);

    const CONCURRENCY = 4;
    let cursor = 0;
    const next = (): number => cursor++;

    async function worker() {
      while (true) {
        const i = next();
        if (i >= cnrs.length) return;
        const cnr = cnrs[i];
        setBatchRows(rows => rows.map((r, idx) => idx === i ? { ...r, status: "running" } : r));
        try {
          const { data, error } = await supabase.functions.invoke("litigation-intel", {
            body: { mode: "cnr", cnr },
          });
          if (error) throw error;
          if ((data as unknown)?.error) throw new Error((data as unknown).error);
          const d = data as IntelResponse;
          const c = (d.court_data as unknown)?.case ?? d.court_data ?? {};
          const fraudMatch = /Fraud & predatory signals:\s*([^\n]+)/i.exec(d.brief ?? "");
          setBatchRows(rows => rows.map((r, idx) => idx === i ? {
            ...r,
            status: "done",
            title: c.title ?? c.case_title ?? `CNR ${cnr}`,
            court: c.court_name ?? c.court ?? c.bench ?? "",
            next_hearing: c.next_hearing_date ?? c.nextHearing ?? c.next_date ?? "",
            brief_excerpt: (d.brief ?? "").slice(0, 240),
            fraud_signal: fraudMatch ? fraudMatch[1].trim() : undefined,
          } : r));
        } catch (e: unknown) {
          setBatchRows(rows => rows.map((r, idx) => idx === i ? {
            ...r, status: "error", error: e?.message ?? "failed",
          } : r));
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, cnrs.length) }, worker));
    setBatchRunning(false);
    toast.success(`Batch complete · ${cnrs.length} CNR${cnrs.length === 1 ? "" : "s"}`);
  }

  // ----- Auto-draft Reply / Written Statement from current intel -----
  async function draftReplyFromIntel() {
    if (!intel || !user) return;
    setCreatingDraft(true);
    try {
      const ref = intel.mode === "cnr" ? cnr.toUpperCase() : (query || intel.query);
      const title = `Reply — ${heading}`.slice(0, 120);
      const { data, error } = await supabase.from("drafts").insert({
        user_id: user.id,
        template: "reply_notice",
        title,
        content: "",
        inputs: {
          case_context: {
            cnr: intel.mode === "cnr" ? cnr.toUpperCase() : null,
            query: intel.mode !== "cnr" ? ref : null,
            heading,
            brief: intel.brief,
            precedents: intel.precedents.map((p, i) => ({
              n: i + 1, title: p.title, source: p.source, date: p.date, url: p.url,
            })),
            court_data: intel.court_data ?? null,
          },
        } as unknown,
      }).select("id").single();
      if (error) throw error;
      toast.success("Draft created with case context");
      navigate(`/app/drafts/${data.id}`);
    } catch (e: unknown) {
      toast.error(e?.message ?? "Could not create draft");
    } finally {
      setCreatingDraft(false);
    }
  }

  const heading = useMemo(() => {
    if (intel?.court_data?.case?.title) return intel.court_data.case.title;
    if (intel?.mode === "cnr") return `CNR ${cnr.toUpperCase()}`;
    if (intel?.mode === "keyword") return query || intel.query;
    if (intel?.mode === "document") return "Document analysis";
    return "Litigation Intelligence";
  }, [intel, cnr, query]);

  return (
    <AppShell title="Litigation Intelligence">
      <div className="container max-w-6xl px-4 py-6 sm:py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Beta · eCourts + Indian Kanoon + Weybre AI</p>
          <h2 className="mt-2 font-serif text-3xl text-primary">One brief. Live court data, precedents, and strategy.</h2>
          <p className="mt-2 text-muted-foreground">
            Track a CNR, search by issue, or upload a document. Weybre fuses the live record with precedent and gives you a litigation playbook.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left column: input + brief */}
          <div className="space-y-6">
            <Card className="p-5">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
                  <TabsTrigger value="cnr" className="text-xs sm:text-sm"><Hash className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> CNR</TabsTrigger>
                  <TabsTrigger value="keyword" className="text-xs sm:text-sm"><Search className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Issue</TabsTrigger>
                  <TabsTrigger value="document" className="text-xs sm:text-sm"><Upload className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Doc</TabsTrigger>
                  <TabsTrigger value="batch" className="text-xs sm:text-sm"><Layers className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Batch</TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === "cnr" && (
                <div className="mt-4 space-y-3">
                  <Input
                    placeholder="e.g. DLCT010012342024 (16 chars)"
                    value={cnr}
                    onChange={(e) => setCnr(e.target.value.toUpperCase())}
                    maxLength={20}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">CNR pulls live hearing dates, judge, last order, and matches precedents.</p>
                </div>
              )}

              {mode === "keyword" && (
                <div className="mt-4 space-y-3">
                  <Textarea
                    placeholder="Describe the legal issue, statute, or fact pattern…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-h-[110px]"
                  />
                </div>
              )}

              {mode === "document" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Upload .txt
                    </Button>
                    <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden onChange={onFileUpload} />
                    <span className="text-xs text-muted-foreground">…or paste text below.</span>
                  </div>
                  <Textarea
                    placeholder="Paste petition, notice, or order text…"
                    value={documentText}
                    onChange={(e) => setDocumentText(e.target.value)}
                    className="min-h-[180px] font-mono text-xs"
                  />
                </div>
              )}

              {mode === "batch" && (
                <div className="mt-4 space-y-3">
                  <Textarea
                    placeholder={"Paste up to 50 CNRs (one per line, comma or space separated)\nDLCT010012342024\nMHCT020045672023"}
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    className="min-h-[140px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Runs Litigation Intel on each CNR in parallel (concurrency 4). Use this for high-volume defence portfolios.
                  </p>
                </div>
              )}

              {mode !== "batch" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(SAMPLES[mode] as string[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (mode === "cnr") setCnr(s);
                        else if (mode === "keyword") setQuery(s);
                        else setDocumentText(s);
                      }}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <AiDisclaimer />
                {mode === "batch" ? (
                  <Button onClick={runBatch} disabled={batchRunning}>
                    {batchRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
                    Run Batch
                  </Button>
                ) : (
                  <Button onClick={runIntel} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Run Intelligence
                  </Button>
                )}
              </div>
            </Card>

            {mode === "batch" && batchRows.length > 0 && (
              <BatchResults rows={batchRows} />
            )}

            {intel && (
              <>
                <Card className="p-6">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{intel.mode === "cnr" ? "Live case" : intel.mode === "document" ? "Document analysis" : "Issue brief"}</p>
                      <h3 className="mt-1 font-serif text-2xl text-primary">{heading}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportAiResultPdf({
                            title: heading || "Litigation Intelligence Brief",
                            subtitle: intel.mode === "cnr" ? "Live case intelligence" : intel.mode === "document" ? "Document analysis" : "Issue brief",
                            query: cnr || query,
                            body: intel.brief,
                            sources: intel.precedents.map((p, i) => ({
                              n: i + 1,
                              title: p.title,
                              url: p.url,
                              source: p.source,
                              date: p.date,
                              cited_by: p.cited_by,
                            })),
                          })
                        }
                      >
                        <Download className="mr-2 h-4 w-4" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={draftReplyFromIntel} disabled={creatingDraft}>
                        {creatingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                        Draft Reply
                      </Button>
                      <Button variant="outline" size="sm" onClick={trackCurrent}>
                        <Bell className="mr-2 h-4 w-4" /> Track
                      </Button>
                    </div>
                  </div>
                  {intel.court_data && !intel.court_data.error && (
                    <CourtSummary data={intel.court_data} />
                  )}
                  <Separator className="my-5" />
                  <div className="prose prose-sm max-w-none text-foreground prose-headings:font-serif prose-headings:text-primary prose-a:text-accent">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => {
                          const url = safeHref(href);
                          if (!url) return <span>{children}</span>;
                          return (
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {intel.brief}
                    </ReactMarkdown>
                  </div>
                </Card>

                {intel.live_cases.length > 0 && (
                  <Card className="p-5">
                    <h4 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      <Gavel className="h-3.5 w-3.5" /> Live court records ({intel.live_cases.length})
                    </h4>
                    <div className="space-y-2">
                      {intel.live_cases.map((c: unknown, i) => (
                        <div key={i} className="rounded-lg border border-border bg-card p-3 text-sm">
                          <div className="font-medium text-primary">{c.title ?? c.case_title ?? "Court record"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {c.cnr ?? c.case_number ?? ""} {c.court ?? ""} {c.last_hearing_date ?? ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Right column: precedents + watchlist */}
          <div className="space-y-6">
            {intel && intel.precedents.length > 0 && (
              <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Cited precedents</p>
                <div className="space-y-2">
                  {intel.precedents.map((p, i) => (
                    <Card key={p.tid} className="p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <Badge variant="secondary" className="shrink-0">[{i + 1}]</Badge>
                        {safeHref(p.url) ? (
                          <a href={safeHref(p.url)!} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                      <p className="text-sm font-medium leading-snug text-primary">{p.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.source ?? ""}{p.date ? ` · ${p.date}` : ""}{p.cited_by ? ` · cited ${p.cited_by}×` : ""}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Watchlist</p>
                <Badge variant="outline">{watch.length}</Badge>
              </div>
              {watch.length === 0 && (
                <Card className="p-4 text-sm text-muted-foreground">
                  Track a CNR or keyword to monitor for new orders, hearings, and matching judgments.
                </Card>
              )}
              <div className="space-y-2">
                {watch.map((w) => (
                  <Card key={w.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary">{w.label}</p>
                        <p className="text-xs text-muted-foreground">
                          <Badge variant="secondary" className="mr-1 text-[10px]">{w.kind}</Badge>
                          {w.last_checked_at ? `Checked ${new Date(w.last_checked_at).toLocaleDateString("en-IN")}` : "Not yet checked"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" onClick={() => refreshWatch(w)} disabled={refreshing === w.id} title="Refresh">
                          {refreshing === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeWatch(w.id)} title="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

function CourtSummary({ data }: { data: unknown }) {
  const c = data?.case ?? data;
  const items: { icon: unknown; label: string; value?: string | null }[] = [
    { icon: Calendar, label: "Next hearing", value: c?.next_hearing_date ?? c?.nextHearing ?? c?.next_date },
    { icon: Gavel, label: "Last order", value: c?.last_order_date ?? c?.lastOrderDate },
    { icon: ScrollText, label: "Stage", value: c?.stage ?? c?.case_stage },
    { icon: ListChecks, label: "Court", value: c?.court_name ?? c?.court ?? c?.bench },
  ];
  const visible = items.filter(i => i.value);
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 md:grid-cols-4">
      {visible.map((i) => {
        const Icon = i.icon;
        return (
          <div key={i.label} className="rounded-md bg-background p-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3 w-3" /> {i.label}
            </div>
            <div className="mt-1 text-sm font-medium text-primary">{i.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function BatchResults({ rows }: { rows: BatchRow[] }) {
  const done = rows.filter(r => r.status === "done").length;
  const errored = rows.filter(r => r.status === "error").length;
  const pct = Math.round(((done + errored) / rows.length) * 100);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Batch results</p>
          <p className="text-sm text-foreground">{done} done · {errored} failed · {rows.length} total</p>
        </div>
        <Badge variant="outline">{pct}%</Badge>
      </div>
      <Progress value={pct} className="mb-4 h-1.5" />
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.cnr} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {r.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                  {r.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                  {r.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
                  {r.status === "pending" && <span className="h-3.5 w-3.5 rounded-full border border-border" />}
                  <span className="font-mono text-xs">{r.cnr}</span>
                </div>
                {r.title && <p className="mt-1 truncate font-medium text-primary">{r.title}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.court ?? ""}{r.next_hearing ? ` · Next: ${r.next_hearing}` : ""}
                </p>
                {r.fraud_signal && r.fraud_signal.toLowerCase() !== "none observed in the available record." && (
                  <p className="mt-1 text-xs text-destructive">⚑ {r.fraud_signal}</p>
                )}
                {r.error && <p className="mt-1 text-xs text-destructive">{r.error}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default Litigation;
