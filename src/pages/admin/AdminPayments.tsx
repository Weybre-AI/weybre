import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: string;
  created_at: string;
  user_id: string;
  provider: string;
  event_type: string;
  amount: number | null;
  currency: string;
  status: string;
  full_name?: string | null;
};

const AdminPayments = () => {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("billing_events").select("id,created_at,user_id,provider,event_type,amount,currency,status").order("created_at", { ascending: false }).limit(500);
      const ids = Array.from(new Set((data ?? []).map((d) => d.user_id)));
      const { data: profiles } = await supabase.from("profiles").select("id,full_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setRows((data ?? []).map((d) => ({ ...d, full_name: pMap.get(d.user_id) ?? null })));
    })();
  }, []);

  return (
    <AdminShell title="Payments & billing events">
      <Card className="p-5">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="font-medium">{r.full_name ?? r.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="capitalize"><Badge variant="outline">{r.provider}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.event_type}</TableCell>
                  <TableCell className="text-right font-mono">{r.amount != null ? `${r.currency} ${(r.amount / 100).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.status}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">No billing events yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </AdminShell>
  );
};

export default AdminPayments;
