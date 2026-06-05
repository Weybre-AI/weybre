import { useCallback, useEffect, useState } from "react";
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, RefreshCw, Trash2, ChevronDown, ChevronRight, Activity } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { invokeFunction } from "@/lib/invokeFunction";
import { useProcessingJob } from "@/hooks/useProcessingJob";

type Clause = {
  clause_id: string;
  clause_type: string;
  actor: string;
  trigger: string[];
  condition: string | null;
  consequence: string;
  notice_period_days: number | null;
  cure_period_days: number | null;
  favors: "PARTY_A" | "PARTY_B" | "balanced" | "unclear";
  verbatim_quote: string;
  page_ref: string;
  confidence: number;
};
type MissingField = { field: string; placeholder_text: string; page_ref: string; operational_impact: string };
type RiskItem = { clause_id: string; severity: "LOW"|"MEDIUM"|"HIGH"; issue: string; why_it_matters: string; confidence: number };
type Analysis = {
  schema_version?: number;
  clauses?: Clause[];
  missing_fields?: MissingField[];
  asymmetry_summary?: { tilt: string; rationale: string; supporting_clause_ids: string[] } | null;
  risk_assessments?: RiskItem[];
  jurisdiction_notes?: { topic: string; note: string; is_commentary: boolean }[];
  parties_detailed?: { name: string; role: string | null; type: string }[];
};

type Contract = {
  id: string;
  file_name: string;
  mime_type: string;
  status: string;
  error_message: string | null;
  doc_type: string | null;
  doc_type_confidence: number;
  jurisdiction: string | null;
  governing_law: string | null;
  risk_level: string | null;
  risk_reasons: string[];
  parties: string[];
  effective_date: string | null;
  expiry_date: string | null;
  renewal_window: string | null;
  termination_clause: string | null;
  char_count: number;
  needs_human_review: boolean;
  created_at: string;
  storage_path: string;
  analysis: Analysis | null;
};

const riskTone = (r: string | null) =>
  r === "HIGH" ? "destructive" : r === "MEDIUM" ? "default" : "secondary";

const sevTone = (s: string) => s === "HIGH" ? "destructive" : s === "MEDIUM" ? "default" : "secondary";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt";

const Intake = () => {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    else setContracts((data ?? []) as unknown as Contract[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("contracts:" + user.id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "contracts", filter: `user_id=eq.${user.id}` },
        () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, load]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";
    if (file.size > 50 * 1024 * 1024) { toast.error("Max 50 MB"); return; }

    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("contract-intake")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase.from("contracts").insert({
        user_id: user.id,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        status: "uploaded",
      }).select("id").single();
      if (insErr) throw insErr;

      toast.info("Queued for background analysis...");
      const { data, error: fnErr } = await invokeFunction("contract-intake", { body: { contractId: row.id } });
      if (fnErr) {
        await supabase.from("contracts").update({ status: "failed", error_message: fnErr.message }).eq("id", row.id);
        toast.error("Job creation failed", { description: fnErr.message });
      } else if (data) {
        toast.success("Analysis started in background");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const retry = async (c: Contract) => {
    toast.info("Restarting background process...");
    const { error: fnErr } = await invokeFunction("contract-intake", { body: { contractId: c.id } });
    if (fnErr) {
      toast.error("Retry failed", { description: fnErr.message });
    }
  };

  const remove = async (c: Contract) => {
    await supabase.storage.from("contract-intake").remove([c.storage_path]);
    await supabase.from("contracts").delete().eq("id", c.id);
  };

  return (
    <AppShell title="Contract Intake">
      <div className="container max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <Card className="p-6 border-primary/20 bg-primary/5">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl text-primary font-bold">Enterprise Async Document Pipeline</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Experience high-scale contract analysis. Our new asynchronous worker pipeline supports large documents, 
                intelligent chunking, and real-time progress updates. Status and stages are tracked in our 
                dedicated jobs table for maximum observability.
              </p>
            </div>
            <label>
              <input type="file" accept={ACCEPTED} className="hidden" onChange={onPick} disabled={uploading} />
              <Button asChild disabled={uploading} size="lg" className="shadow-lg">
                <span className="cursor-pointer">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  {uploading ? "Uploading..." : "Analyze Contract"}
                </span>
              </Button>
            </label>
          </div>
          <AiDisclaimer className="mt-4" />
        </Card>

        <div className="space-y-4">
          {contracts.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground italic border-dashed">
              No documents processed yet.
            </Card>
          )}
          {contracts.map((c) => <Row key={c.id} c={c} onRetry={retry} onRemove={remove} />)}
        </div>
      </div>
    </AppShell>
  );
};

const Row = ({ c, onRetry, onRemove }: { c: Contract; onRetry: (c: Contract) => void; onRemove: (c: Contract) => void }) => {
  const [open, setOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { job } = useProcessingJob(activeJobId);

  useEffect(() => {
    if (c.status === 'uploaded' || c.status === 'processing') {
      const findJob = async () => {
        const { data } = await supabase.from('processing_jobs')
          .select('id')
          .eq('resource_id', c.id)
          .neq('status', 'completed')
          .neq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setActiveJobId(data.id);
      };
      void findJob();
    }
  }, [c.status, c.id]);

  const processing = c.status === "uploaded" || c.status === "processing" || (job && job.status === 'processing');
  const failed = c.status === "failed" || (job && job.status === 'failed');
  const review = c.status === "needs_review" || c.needs_human_review;
  const a = c.analysis ?? {};
  const clauses = a.clauses ?? [];
  const missing = a.missing_fields ?? [];
  const risks = a.risk_assessments ?? [];
  const notes = a.jurisdiction_notes ?? [];

  return (
    <Card className={`p-5 transition-all duration-300 ${processing ? 'ring-2 ring-primary/20 bg-muted/20' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="truncate font-bold text-primary">{c.file_name}</p>
            
            {processing && (
              <Badge variant="secondary" className="animate-pulse">
                <Activity className="h-3 w-3 mr-1" />
                {job?.stage ? job.stage.toUpperCase() : 'QUEUED'}
              </Badge>
            )}
            
            {failed && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Failed</Badge>}
            {c.status === "ready" && !processing && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Ready</Badge>}
            
            {c.doc_type && <Badge variant="outline">{c.doc_type}</Badge>}
            {c.risk_level && <Badge variant={riskTone(c.risk_level) as never}>{c.risk_level} risk</Badge>}
          </div>

          {processing && job && (
            <div className="mt-4 space-y-2 max-w-md">
              <div className="flex justify-between text-xs font-mono text-muted-foreground">
                <span>Stage: {job.stage}</span>
                <span>{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="h-1.5" />
            </div>
          )}

          {(failed || job?.status === 'failed') && (
            <p className="mt-2 text-sm text-destructive font-mono bg-destructive/10 p-2 rounded border border-destructive/20">
              Error: {c.error_message || job?.error_message || "Processing failed unexpectedly"}
            </p>
          )}

          {(c.status === "ready" || review) && !processing && (
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Parties" value={c.parties?.length ? c.parties.join(" · ") : "—"} />
                <Field label="Jurisdiction" value={c.jurisdiction ?? "—"} />
                <Field label="Governing law" value={c.governing_law ?? "—"} />
                <Field label="Effective → expiry" value={`${c.effective_date ?? "—"}  →  ${c.expiry_date ?? "—"}`} />
              </div>

              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground font-bold mt-2"
              >
                {open ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
                {open ? "Hide" : "Show"} Analysis Details ({clauses.length} clauses)
              </button>

              {open && (
                <div className="space-y-4 border-t pt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  {clauses.length > 0 && (
                    <Section label="Extracted Clauses">
                      <div className="space-y-2">
                        {clauses.map((cl, idx) => <ClauseCard key={idx} cl={cl} />)}
                      </div>
                    </Section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {!processing && (
            <Button variant="ghost" size="icon" onClick={() => onRetry(c)} title="Restart Process">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onRemove(c)} title="Delete Document">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

const ClauseCard = ({ cl }: { cl: any }) => (
  <div className="rounded border p-3 bg-muted/10 hover:bg-muted/30 transition-colors">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="font-mono text-[10px]">{cl.id || 'clause'}</Badge>
      <span className="font-mono text-xs text-muted-foreground">{cl.label}</span>
      {cl.risk_level && <Badge variant={sevTone(cl.risk_level) as never} className="text-[10px]">{cl.risk_level} risk</Badge>}
    </div>
    <div className="mt-2 text-xs text-foreground/90">
      {cl.verbatim_quote && (
        <blockquote className="mt-1 border-l-4 border-primary/20 bg-muted/30 p-2 italic font-serif leading-relaxed">
          "{cl.verbatim_quote}"
        </blockquote>
      )}
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {cl.actor && <div><span className="text-muted-foreground font-mono uppercase text-[10px] block">Actor</span>{cl.actor}</div>}
        {cl.consequence && <div><span className="text-muted-foreground font-mono uppercase text-[10px] block">Consequence</span>{cl.consequence}</div>}
      </div>
    </div>
  </div>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mt-4">
    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b pb-1 mb-2">{label}</p>
    <div>{children}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-muted/5 p-2 rounded border border-muted">
    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</p>
    <p className="mt-0.5 text-sm font-medium text-primary">{value}</p>
  </div>
);

export default Intake;
