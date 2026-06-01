import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Users, CreditCard, IndianRupee, TrendingUp, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LS_OFFSET = "weybre.hfIngestOffset";

const AdminOverview = () => {
  const [stats, setStats] = useState({ users: 0, active: 0, mrr: 0, queries: 0, drafts: 0, judgments: 0 });
  const [offset, setOffset] = useState<number>(() => Number(localStorage.getItem(LS_OFFSET) ?? 0));
  const [limit, setLimit] = useState(50);
  const [withEmbed, setWithEmbed] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<unknown>(null);

  async function loadStats() {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [{ count: users }, { data: subs }, { count: queries }, { count: drafts }, { count: judgments }, { data: plans }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("subscriptions").select("plan,status"),
      supabase.from("usage_events").select("*", { count: "exact", head: true }).eq("event_type", "research_query").gte("created_at", monthStart.toISOString()),
      supabase.from("drafts").select("*", { count: "exact", head: true }),
      supabase.from("judgments").select("*", { count: "exact", head: true }),
      supabase.from("billing_plans").select("id, price_monthly"),
    ]);

    const active = subs?.filter((s) => s.status === "active").length ?? 0;
    const planMap = (plans ?? []).reduce((acc, p) => ({ ...acc, [p.id]: p.price_monthly }), {} as Record<string, number>);
    const mrr = (subs ?? []).reduce((acc, s) => acc + (s.status === "active" ? (planMap[s.plan] ?? 0) : 0), 0);
    setStats({ users: users ?? 0, active, mrr, queries: queries ?? 0, drafts: drafts ?? 0, judgments: judgments ?? 0 });
  }

  useEffect(() => { void loadStats(); }, []);

  async function runSync(autoAdvance = false) {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-judgments", {
        body: { source: "hf", offset, limit, embed: withEmbed },
      });
      if (error) throw error;
      setLastResult(data);
      if (data?.next_offset != null) {
        setOffset(data.next_offset);
        localStorage.setItem(LS_OFFSET, String(data.next_offset));
      }
      toast.success(`Ingested ${data?.ok ?? 0} of ${data?.processed ?? 0} (failed ${data?.failed ?? 0})`);
      void loadStats();
      if (autoAdvance && data?.processed > 0 && data?.next_offset != null && (data?.total == null || data.next_offset < data.total)) {
        setTimeout(() => void runSync(true), 600);
      }
    } catch (e: unknown) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  function resetOffset() {
    setOffset(0); localStorage.setItem(LS_OFFSET, "0"); setLastResult(null);
  }

  return (
    <AdminShell title="Overview">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Total customers" value={stats.users} />
        <Stat icon={<CreditCard className="h-4 w-4" />} label="Active subs" value={stats.active} />
        <Stat icon={<IndianRupee className="h-4 w-4" />} label="MRR (active)" value={`₹${stats.mrr.toLocaleString("en-IN")}`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Queries this month" value={stats.queries} sub={`${stats.drafts} total drafts`} />
      </div>

      <Card className="mt-6 p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Database className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-lg font-semibold">Judgments corpus · Hugging Face sync</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Streams <code className="text-xs">Hibbaan/indian-case-laws</code> (~17M rows) into the <code className="text-xs">judgments</code> table. Resumable.
              Embeddings are <strong>opt-in</strong> — leave off for the bulk load, then re-run a curated subset with embeddings on.
              Currently stored: <strong>{stats.judgments.toLocaleString()}</strong> rows.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">Offset</Label>
                <Input type="number" value={offset} onChange={e => setOffset(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Batch size (max 100)</Label>
                <Input type="number" value={limit} min={1} max={100} onChange={e => setLimit(Math.min(100, Math.max(1, Number(e.target.value))))} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={withEmbed} onCheckedChange={setWithEmbed} />
                <Label className="text-xs">Generate embeddings</Label>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => runSync(false)} disabled={running}>
                  {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Run 1 batch
                </Button>
                <Button variant="outline" onClick={() => runSync(true)} disabled={running}>Run continuously</Button>
                <Button variant="ghost" onClick={resetOffset} disabled={running}>Reset</Button>
              </div>
            </div>

            {lastResult && (
              <pre className="mt-4 overflow-x-auto rounded bg-muted/50 p-3 text-[0.7rem] leading-snug">
{JSON.stringify(lastResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </Card>
    </AdminShell>
  );
};

const Stat = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) => (
  <Card className="p-5">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">{icon}</span>
      {label}
    </div>
    <div className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground">{value}</div>
    {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
  </Card>
);

export default AdminOverview;
