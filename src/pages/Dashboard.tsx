import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Search, FileText, FolderOpen, ArrowRight, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Matter { id: string; name: string; client: string | null; created_at: string; }

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ queries: 0, drafts: 0, matters: 0 });
  const [name, setName] = useState("");
  const [recentMatters, setRecentMatters] = useState<Matter[]>([]);
  const [loadingMatters, setLoadingMatters] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const [{ count: queries }, { count: drafts }, { count: matters }, { data: profile }, { data: mData }] = await Promise.all([
        supabase.from("usage_events").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("event_type", "research_query").gte("created_at", monthStart.toISOString()),
        supabase.from("drafts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("matters").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("matters").select("id, name, client, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
      ]);
      setStats({ queries: queries ?? 0, drafts: drafts ?? 0, matters: matters ?? 0 });
      setName(profile?.full_name?.split(" ")[0] ?? "");
      setRecentMatters(mData ?? []);
      setLoadingMatters(false);
    })().catch(err => {
      console.error("Dashboard load error:", err);
      setLoadingMatters(false);
    });
  }, [user]);

  return (
    <AppShell title="Workspace">
      <div className="container max-w-6xl px-4 py-6 sm:py-10">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Today</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-primary">
          Good to see you{name ? `, ${name}` : ""}.
        </h2>
        <p className="mt-2 text-muted-foreground">Where would you like to start?</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard label="Research queries this month" value={stats.queries} />
          <StatCard label="Drafts created" value={stats.drafts} />
          <StatCard label="Active matters" value={stats.matters} />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <ActionCard
            to="/app/research"
            icon={<Search className="h-5 w-5" />}
            title="Start research"
            body="Ask a legal question. Get a cited answer in seconds."
          />
          <ActionCard
            to="/app/drafts"
            icon={<FileText className="h-5 w-5" />}
            title="Draft a contract"
            body="NDA, employment, notice and more — grounded in precedent."
          />
        </div>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-primary">Recent matters</h3>
              <p className="text-sm text-muted-foreground">Organize research and drafts by client or case.</p>
            </div>
            <Button asChild variant="outline" size="sm"><Link to="/app/matters">View all <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>

          <div className="mt-6 grid gap-3">
            {loadingMatters ? (
              <div className="py-4 text-center text-sm text-muted-foreground animate-pulse">Loading matters…</div>
            ) : recentMatters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">No matters yet. Start by creating one for your client.</p>
                <Button asChild variant="link" className="mt-1 h-auto p-0"><Link to="/app/matters">Create matter</Link></Button>
              </div>
            ) : (
              recentMatters.map(m => (
                <Link key={m.id} to={`/app/matters/${m.id}`} className="group flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 transition-colors hover:bg-accent/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-soft text-accent"><FolderOpen className="h-4 w-4" /></div>
                    <div>
                      <div className="font-medium text-primary group-hover:text-primary-glow">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.client || "No client specified"}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="font-serif text-3xl font-semibold text-primary">{value}</div>
    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
  </div>
);

const ActionCard = ({ to, icon, title, body }: { to: string; icon: React.ReactNode; title: string; body: string }) => (
  <Link to={to} className="group block rounded-xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:shadow-md">
    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">{icon}</div>
    <h3 className="font-serif text-xl font-semibold text-primary">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
      Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </div>
  </Link>
);

export default Dashboard;
