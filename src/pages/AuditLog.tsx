import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganizations } from "@/hooks/useOrganizations";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

interface AuditRow {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTIONS = [
  "all",
  "member.added", "member.role_changed", "member.removed",
  "invite.created", "invite.accepted", "invite.revoked",
  "data.access",
];

export default function AuditLog() {
  const { currentOrg } = useOrganizations();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");

  const canView = currentOrg?.role === "owner" || currentOrg?.role === "admin";

  async function load() {
    if (!currentOrg || !canView) return;
    setLoading(true);
    let q = (supabase as any)
      .from("audit_logs")
      .select("id,organization_id,actor_user_id,actor_email,action,resource_type,resource_id,metadata,created_at")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (action !== "all") q = q.eq("action", action);
    if (actor.trim()) q = q.ilike("actor_email", `%${actor.trim()}%`);
    const { data, error } = await q;
    setLoading(false);
    if (!error) setRows((data ?? []) as AuditRow[]);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [currentOrg?.id, action]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      r.action.toLowerCase().includes(s)
      || (r.actor_email ?? "").toLowerCase().includes(s)
      || JSON.stringify(r.metadata).toLowerCase().includes(s)
    );
  }, [rows, search]);

  return (
    <AppShell title="Audit log">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:p-8">
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-semibold">Activity audit</h2>
              <p className="text-sm text-muted-foreground">
                {currentOrg ? <>Events recorded for <span className="font-medium">{currentOrg.name}</span></> : "Select an organization to view its audit trail."}
              </p>
            </div>
            <Button variant="outline" onClick={load} disabled={loading || !canView}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {!currentOrg ? null : !canView ? (
            <p className="mt-4 text-sm text-muted-foreground">Only org owners and admins can view audit logs.</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Action</Label>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Actor email contains</Label>
                  <Input value={actor} onChange={e => setActor(e.target.value)} onBlur={load} placeholder="user@firm.com" />
                </div>
                <div>
                  <Label className="text-xs">Free-text search</Label>
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="resource id, role, email…" />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events match.</p>
                ) : filtered.map(r => (
                  <div key={r.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[0.7rem]">{r.action}</Badge>
                      <span className="text-sm font-medium">{r.actor_email ?? "system"}</span>
                      {r.resource_type && (
                        <span className="text-xs text-muted-foreground">on {r.resource_type}{r.resource_id ? ` · ${r.resource_id.slice(0, 8)}` : ""}</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-[0.7rem] leading-snug text-muted-foreground">
{JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
