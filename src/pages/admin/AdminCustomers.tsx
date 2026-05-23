import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";

type Row = {
  id: string;
  full_name: string | null;
  firm_name: string | null;
  phone: string | null;
  bar_council_number: string | null;
  created_at: string;
  plan?: string | null;
  status?: string | null;
};

const AdminCustomers = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,firm_name,phone,bar_council_number,created_at").order("created_at", { ascending: false }).limit(500);
      const { data: subs } = await supabase.from("subscriptions").select("user_id,plan,status");
      const subMap = new Map((subs ?? []).map((s) => [s.user_id, s]));
      setRows((profiles ?? []).map((p) => ({ ...p, plan: subMap.get(p.id)?.plan ?? null, status: subMap.get(p.id)?.status ?? null })));
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.full_name, r.firm_name, r.phone, r.bar_council_number, r.id].some((v) => v?.toLowerCase().includes(t))
    );
  }, [rows, q]);

  return (
    <AdminShell title="Customers">
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, firm, phone, bar council…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.firm_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.phone ?? "—"}</TableCell>
                  <TableCell className="capitalize">{r.plan ?? "—"}</TableCell>
                  <TableCell>{r.status ? <StatusBadge status={r.status} /> : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </AdminShell>
  );
};

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active: "bg-success/10 text-success border-success/20",
    trialing: "bg-accent-soft text-accent border-accent/20",
    past_due: "bg-warning/10 text-warning border-warning/20",
    cancelled: "bg-muted text-muted-foreground border-border",
    incomplete: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
};

export default AdminCustomers;
