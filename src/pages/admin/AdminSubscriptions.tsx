import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./AdminCustomers";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  dodo_subscription_id: string | null;
  is_manual_billing?: boolean;
  full_name?: string | null;
  firm_name?: string | null;
};

const AdminSubscriptions = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data: subs } = await supabase.from("subscriptions").select("id,user_id,plan,status,current_period_end,dodo_subscription_id,is_manual_billing").order("status").limit(500);
    const ids = (subs ?? []).map((s) => s.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,firm_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setRows((subs ?? []).map((s) => ({ ...s, full_name: pMap.get(s.user_id)?.full_name, firm_name: pMap.get(s.user_id)?.firm_name })));
  };
  useEffect(() => { load(); }, []);

  const cancel = async (userId: string) => {
    if (!confirm("Cancel this subscription via Dodo Payments?")) return;
    setBusy(userId);
    try {
      const { error } = await supabase.functions.invoke("cancel-dodo-subscription", { body: { user_id: userId } });
      if (error) throw error;
      toast.success("Subscription cancelled");
      await load();
    } catch (e: unknown) {
      toast.error(e?.message ?? "Failed to cancel");
    } finally {
      setBusy(null);
    }
  };

  const provisionEnterprise = async (userId: string) => {
    if (!confirm("Manually provision 12 months of Enterprise access for this user? This bypasses Dodo Payments.")) return;
    setBusy(userId);
    try {
      const { error } = await supabase.rpc("provision_enterprise_plan", { _user_id: userId, _duration_months: 12 });
      if (error) throw error;
      toast.success("Enterprise plan provisioned manually");
      await load();
    } catch (e: unknown) {
      toast.error(e?.message ?? "Failed to provision");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell title="Subscriptions">
      <Card className="p-5">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Period end</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.firm_name ?? ""}</div>
                  </TableCell>
                  <TableCell className="capitalize">{r.plan}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {r.is_manual_billing ? (
                      <span className="text-[0.65rem] font-bold uppercase tracking-tight text-accent">Manual</span>
                    ) : (
                      <span className="text-[0.65rem] font-bold uppercase tracking-tight text-muted-foreground">Automated</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("en-IN") : "—"}</TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    {r.status === "active" && r.dodo_subscription_id && (
                      <Button size="sm" variant="outline" disabled={busy === r.user_id} onClick={() => cancel(r.user_id)}>
                        {busy === r.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel"}
                      </Button>
                    )}
                    {r.plan !== 'enterprise' && (
                      <Button size="sm" variant="secondary" disabled={busy === r.user_id} onClick={() => provisionEnterprise(r.user_id)}>
                        {busy === r.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enterprise"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </AdminShell>
  );
};

export default AdminSubscriptions;
