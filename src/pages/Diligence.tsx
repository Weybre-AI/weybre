import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, Users, TrendingUp, Calendar, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface JudgeStat {
  id: string;
  judge_name: string;
  court: string;
  disposal_rate: number;
  avg_duration_days: number;
  grant_rate_bail: number;
  grant_rate_injunction: number;
}

const LitigationAnalytics = () => {
  const [stats, setStats] = useState<JudgeStat[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [statsRes, systemRes] = await Promise.all([
        supabase.from("judge_stats").select("*"),
        supabase.rpc("get_system_legal_stats")
      ]);
      
      if (statsRes.data) setStats(statsRes.data as JudgeStat[]);
      if (systemRes.data) setSystemStats(systemRes.data);
      
      setLoading(false);
    })();
  }, []);

  const filtered = stats.filter(s => 
    s.judge_name.toLowerCase().includes(search.toLowerCase()) || 
    s.court.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell title="Litigation Analytics">
      <div className="container max-w-7xl space-y-8 px-4 py-6 sm:py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard 
            title="System-wide Disposal Rate" 
            value={systemStats ? `${(systemStats.avg_disposal_rate * 100).toFixed(0)}` : "—"} 
            detail="Avg. cases/judge" 
            icon={TrendingUp} 
            color="text-green-600" 
          />
          <StatCard 
            title="Avg. Wait Time" 
            value={systemStats ? `${systemStats.avg_wait_days}` : "—"} 
            detail="Days to disposal" 
            icon={Calendar} 
            color="text-amber-600" 
          />
          <StatCard 
            title="Total Judges Tracked" 
            value={systemStats ? `${systemStats.total_judges.toLocaleString()}` : "—"} 
            detail={`Across ${systemStats ? (systemStats.total_judgments / 1000).toFixed(0) : 0}k judgments`} 
            icon={Users} 
            color="text-blue-600" 
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold text-primary flex items-center gap-2">
              <Scale className="h-5 w-5 text-accent" />
              Judge Intelligence
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search judge or court..." 
                className="pl-8 h-8 text-xs" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground">Loading analytics...</div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground italic border-dashed border rounded-lg">
                No judge data available in the current corpus.
              </div>
            ) : (
              filtered.map(s => (
                <Card key={s.id} className="p-5 space-y-4 hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="font-bold text-primary">{s.judge_name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {s.court}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-2.5 rounded text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Bail Grant Rate</p>
                      <p className="text-lg font-serif font-bold text-primary">{(s.grant_rate_bail * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-muted/30 p-2.5 rounded text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Injunction Rate</p>
                      <p className="text-lg font-serif font-bold text-primary">{(s.grant_rate_injunction * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Disposal Efficiency</span>
                      <span className="font-bold">{(s.disposal_rate * 10).toFixed(1)}/10</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${s.disposal_rate * 100}%` }} />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

const StatCard = ({ title, value, detail, icon: Icon, color }: any) => (
  <Card className="p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-serif font-bold text-primary">{value}</h3>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </div>
      </div>
      <div className={`p-3 rounded-full bg-muted/20 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </Card>
);

export default LitigationAnalytics;
