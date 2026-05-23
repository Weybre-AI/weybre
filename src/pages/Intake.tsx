import { useCallback, useEffect, useState } from "react";
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { invokeFunction } from "@/lib/invokeFunction";

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
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20 MB"); return; }

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

      toast.success("Uploaded — extracting structured clauses…");
      const { error: fnErr } = await invokeFunction("contract-intake", { body: { contractId: row.id } });
      if (fnErr) {
        await supabase.from("contracts").update({ status: "failed", error_message: fnErr.message }).eq("id", row.id);
        toast.error("Analysis failed", { description: fnErr.message });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const retry = async (c: Contract) => {
    await supabase.from("contracts").update({ status: "processing", error_message: null }).eq("id", c.id);
    const { error: fnErr } = await invokeFunction("contract-intake", { body: { contractId: c.id } });
    if (fnErr) {
      await supabase.from("contracts").update({ status: "failed", error_message: fnErr.message }).eq("id", c.id);
      toast.error("Analysis failed", { description: fnErr.message });
    }
  };

  const remove = async (c: Contract) => {
    await supabase.storage.from("contract-intake").remove([c.storage_path]);
    await supabase.from("contracts").delete().eq("id", c.id);
  };

  return (
    <AppShell title="Contract Intake">
      <div className="container max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <Card className="p-6">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-serif text-xl text-primary">Structure-first contract extraction.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The agent extracts clauses as logic — actor, trigger, condition, consequence — with verbatim
                quotes and page references. Facts, risk inference, and jurisdictional commentary are kept
                in separate layers. Blank placeholders are flagged, not silently dropped.
              </p>
            </div>
            <label>
              <input type="file" accept={ACCEPTED} className="hidden" onChange={onPick} disabled={uploading} />
              <Button asChild disabled={uploading}>
                <span className="cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Upload contract"}
                </span>
              </Button>
            </label>
          </div>
          <AiDisclaimer className="mt-4" />
        </Card>

        <div className="space-y-3">
          {contracts.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No contracts yet. Upload one to begin.
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
  const processing = c.status === "uploaded" || c.status === "processing";
  const failed = c.status === "failed";
  const review = c.status === "needs_review" || c.needs_human_review;
  const a = c.analysis ?? {};
  const clauses = a.clauses ?? [];
  const missing = a.missing_fields ?? [];
  const risks = a.risk_assessments ?? [];
  const notes = a.jurisdiction_notes ?? [];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="truncate font-medium text-primary">{c.file_name}</p>
            {processing && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin" /> Extracting</Badge>}
            {failed && <Badge variant="destructive"><AlertTriangle className="h-3 w-3" /> Failed</Badge>}
            {review && !processing && !failed && <Badge variant="default"><AlertTriangle className="h-3 w-3" /> Review</Badge>}
            {c.status === "ready" && <Badge variant="secondary"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>}
            {c.doc_type && <Badge variant="outline">{c.doc_type} · {(c.doc_type_confidence * 100).toFixed(0)}%</Badge>}
            {c.risk_level && <Badge variant={riskTone(c.risk_level) as never}>{c.risk_level} risk</Badge>}
            {clauses.length > 0 && <Badge variant="outline">{clauses.length} clauses</Badge>}
            {missing.length > 0 && <Badge variant="destructive">{missing.length} blank placeholder{missing.length>1?"s":""}</Badge>}
          </div>

          {failed && c.error_message && (
            <p className="mt-2 text-sm text-destructive">{c.error_message}</p>
          )}

          {(c.status === "ready" || review) && (
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Parties" value={c.parties?.length ? c.parties.join(" · ") : "—"} />
                <Field label="Jurisdiction" value={c.jurisdiction ?? "—"} />
                <Field label="Governing law" value={c.governing_law ?? "—"} />
                <Field label="Effective → expiry" value={`${c.effective_date ?? "—"}  →  ${c.expiry_date ?? "—"}`} />
              </div>

              {missing.length > 0 && (
                <Section label="Blank placeholders (operationally material)">
                  <ul className="space-y-1.5">
                    {missing.map((m, i) => (
                      <li key={i} className="rounded border border-destructive/30 bg-destructive/5 p-2">
                        <div className="font-mono text-xs">{m.field} · <span className="text-muted-foreground">{m.page_ref}</span></div>
                        <div className="mt-0.5"><span className="text-muted-foreground">Placeholder:</span> <code className="rounded bg-muted px-1">{m.placeholder_text}</code></div>
                        {m.operational_impact && <div className="mt-0.5 text-muted-foreground">Impact: {m.operational_impact}</div>}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {a.asymmetry_summary && (
                <Section label={`Asymmetry — tilts ${a.asymmetry_summary.tilt}`}>
                  <p className="text-muted-foreground">{a.asymmetry_summary.rationale}</p>
                </Section>
              )}

              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
                {open ? "Hide" : "Show"} structured clauses, risk & commentary
              </button>

              {open && (
                <div className="space-y-4 border-t pt-3">
                  {clauses.length > 0 && (
                    <Section label="Layer 1 — Clauses (facts, grounded)">
                      <div className="space-y-2">
                        {clauses.map((cl) => <ClauseCard key={cl.clause_id} cl={cl} />)}
                      </div>
                    </Section>
                  )}
                  {risks.length > 0 && (
                    <Section label="Layer 2 — Risk inference">
                      <ul className="space-y-1.5">
                        {risks.map((r, i) => (
                          <li key={i} className="rounded border p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={sevTone(r.severity) as never}>{r.severity}</Badge>
                              <span className="font-mono text-xs text-muted-foreground">→ clause {r.clause_id}</span>
                              <span className="text-xs text-muted-foreground">· conf {(r.confidence*100).toFixed(0)}%</span>
                            </div>
                            <div className="mt-1 font-medium">{r.issue}</div>
                            {r.why_it_matters && <div className="text-muted-foreground">{r.why_it_matters}</div>}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                  {notes.length > 0 && (
                    <Section label="Layer 3 — Jurisdictional commentary (not from contract text)">
                      <ul className="space-y-1.5 text-muted-foreground">
                        {notes.map((n, i) => (
                          <li key={i}><span className="font-medium text-foreground">{n.topic}:</span> {n.note}</li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {(failed || c.status === "ready" || review) && (
            <Button variant="ghost" size="icon" onClick={() => onRetry(c)} title="Re-extract">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onRemove(c)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

const ClauseCard = ({ cl }: { cl: Clause }) => (
  <div className="rounded border p-2.5">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{cl.clause_type}</Badge>
      <span className="font-mono text-xs text-muted-foreground">{cl.clause_id} · {cl.page_ref}</span>
      <Badge variant="secondary">favors {cl.favors}</Badge>
      <span className="text-xs text-muted-foreground">conf {(cl.confidence*100).toFixed(0)}%</span>
    </div>
    <div className="mt-2 grid gap-1.5 text-xs md:grid-cols-2">
      <div><span className="font-mono uppercase text-muted-foreground">Actor:</span> {cl.actor}</div>
      <div><span className="font-mono uppercase text-muted-foreground">Triggers:</span> {cl.trigger?.join(" · ") || "—"}</div>
      {cl.condition && <div className="md:col-span-2"><span className="font-mono uppercase text-muted-foreground">Condition:</span> {cl.condition}</div>}
      <div className="md:col-span-2"><span className="font-mono uppercase text-muted-foreground">Consequence:</span> {cl.consequence}</div>
      {(cl.notice_period_days != null || cl.cure_period_days != null) && (
        <div className="md:col-span-2 text-muted-foreground">
          {cl.notice_period_days != null && <>Notice: {cl.notice_period_days}d</>}
          {cl.notice_period_days != null && cl.cure_period_days != null && " · "}
          {cl.cure_period_days != null && <>Cure: {cl.cure_period_days}d</>}
        </div>
      )}
    </div>
    {cl.verbatim_quote && (
      <blockquote className="mt-2 border-l-2 border-primary/40 bg-muted/40 p-2 font-serif text-xs italic text-foreground/80">
        "{cl.verbatim_quote}"
      </blockquote>
    )}
  </div>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="mt-1.5">{children}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-foreground">{value}</p>
  </div>
);

export default Intake;
