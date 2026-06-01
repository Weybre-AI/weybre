import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/safeHref";
import { toast } from "sonner";
import { Loader2, Sparkles, ExternalLink, Scale, FileSearch, TrendingUp, Download } from "lucide-react";
import { exportAiResultPdf } from "@/lib/exportPdf";
import ReactMarkdown from "react-markdown";

type Mode = "guide" | "predict" | "contract";

interface CaseRef {
  n: number;
  tid: number;
  title: string;
  source?: string;
  date?: string;
  cited_by?: number;
  url: string;
  excerpt: string;
}

interface DecisionEngineResponse {
  answer: string;
  cases: CaseRef[];
  error?: string;
}

const SAMPLES: Record<Mode, string[]> = {
  guide: [
    "My landlord increased rent by 40% mid-lease. What are my rights under the Rent Control Act?",
    "Employee terminated without notice during probation — can they claim wrongful termination?",
    "Builder delayed possession by 3 years — how to claim refund with interest under RERA?",
  ],
  predict: [
    "Filing for anticipatory bail in a 498A case — likelihood given clean record?",
    "Specific performance suit filed 4 years after breach — prospects?",
    "Challenging dismissal as workman under Industrial Disputes Act after 18-year service.",
  ],
  contract: [
    "Review the indemnity clause for risk exposure",
    "Is this non-compete enforceable under Indian law?",
  ],
};

const MODE_META: Record<Mode, { label: string; icon: React.ElementType; placeholder: string }> = {
  guide: { label: "Guide me", icon: Scale, placeholder: "Describe the situation in plain English…" },
  predict: { label: "Predict outcome", icon: TrendingUp, placeholder: "Describe the case, parties, facts and relief sought…" },
  contract: { label: "Contract review", icon: FileSearch, placeholder: "Add context (optional) — e.g. 'SaaS MSA between Indian vendor and US client'" },
};

const Decide = () => {
  const [mode, setMode] = useState<Mode>("guide");
  const [problem, setProblem] = useState("");
  const [contract, setContract] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRef[]>([]);

  const submit = async () => {
    if (mode !== "contract" && problem.trim().length < 5) {
      toast.error("Describe the problem in at least a sentence.");
      return;
    }
    if (mode === "contract" && contract.trim().length < 20) {
      toast.error("Paste the clause or contract text.");
      return;
    }
    setLoading(true);
    setAnswer(null);
    setCases([]);
    try {
      const { data, error } = await supabase.functions.invoke<DecisionEngineResponse>("decision-engine", {
        body: { problem, contract, mode },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAnswer(data.answer);
      setCases(data.cases ?? []);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Decision engine failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Decision Engine">
      <div className="container max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Beta · Powered by Indian Kanoon</p>
          <h2 className="mt-2 font-serif text-3xl text-primary">Tell us the problem. Get cited guidance.</h2>
          <p className="mt-2 text-muted-foreground">
            Real-world problem in, retrieved precedents + extracted arguments + recommended next steps out.
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-6">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
            {(Object.keys(MODE_META) as Mode[]).map((m) => {
              const Icon = MODE_META[m].icon;
              return (
                <TabsTrigger key={m} value={m}>
                  <Icon className="mr-2 h-4 w-4" />
                  {MODE_META[m].label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <Card className="p-5">
          {mode === "contract" && (
            <Textarea
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              placeholder="Paste the clause or contract section here…"
              className="mb-3 min-h-[160px] font-mono text-sm"
            />
          )}
          <Textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder={MODE_META[mode].placeholder}
            className="min-h-[100px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLES[mode].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => (mode === "contract" ? setProblem(s) : setProblem(s))}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/10 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <AiDisclaimer />
            <Button onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Run Decision Engine
            </Button>
          </div>
        </Card>

        {answer && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card className="p-6">
              <div className="mb-3 flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportAiResultPdf({
                      title:
                        mode === "contract"
                          ? "Contract risk analysis"
                          : mode === "predict"
                          ? "Outcome prediction"
                          : "Decision Engine brief",
                      subtitle: MODE_META[mode].label,
                      query: mode === "contract" ? problem || "(contract review)" : problem,
                      body: answer,
                      sources: cases.map((c) => ({
                        n: c.n,
                        title: c.title,
                        url: c.url,
                        source: c.source,
                        date: c.date,
                        cited_by: c.cited_by,
                      })),
                    })
                  }
                >
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </div>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap font-sans text-foreground">
                {answer}
              </div>
            </Card>
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Cited cases</p>
              {cases.map((c) => (
                <Card key={c.tid} className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Badge variant="secondary">[{c.n}]</Badge>
                    {safeHref(c.url) ? (
                      <a href={safeHref(c.url)!} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium leading-snug text-primary">{c.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.source} {c.date ? `· ${c.date}` : ""}{c.cited_by ? ` · cited by ${c.cited_by}` : ""}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Decide;
