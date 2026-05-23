import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { M365IntegrationPanel } from "@/components/M365IntegrationPanel";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { sub } = useSubscription();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data); setLoading(false);
    });
  }, [user]);

  const save = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name, firm_name: profile.firm_name,
      bar_council_number: profile.bar_council_number, phone: profile.phone,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  const deleteAll = async () => {
    if (!user) return;
    setDeleting(true);
    // RLS-safe cascading: delete user-owned data; auth user removal happens via edge function in production.
    await Promise.all([
      supabase.from("drafts").delete().eq("user_id", user.id),
      supabase.from("research_notes").delete().eq("user_id", user.id),
      supabase.from("matters").delete().eq("user_id", user.id),
      supabase.from("usage_events").delete().eq("user_id", user.id),
    ]);
    toast.success("All your data has been deleted");
    setDeleting(false); setDeleteOpen(false);
    await signOut(); nav("/");
  };

  const cancelPlan = async () => {
    setCancelling(true);
    const { error } = await supabase.functions.invoke("cancel-dodo-subscription");
    setCancelling(false);
    if (error) toast.error(error.message); else toast.success("Cancellation requested", { description: "Your plan will stop through Dodo Payments." });
  };

  if (loading) return <AppShell title="Settings"><div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div></AppShell>;

  return (
    <AppShell title="Settings">
      <div className="container max-w-3xl space-y-8 px-4 py-6 sm:py-8">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-serif text-lg font-semibold text-primary">Profile</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={profile?.full_name ?? ""} onChange={e => setProfile({ ...profile, full_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Firm</Label><Input value={profile?.firm_name ?? ""} onChange={e => setProfile({ ...profile, firm_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Bar Council number</Label><Input value={profile?.bar_council_number ?? ""} onChange={e => setProfile({ ...profile, bar_council_number: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={profile?.phone ?? ""} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div>
          </div>
          <div className="mt-5 flex justify-end"><Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary-glow">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button></div>
        </section>

        <M365IntegrationPanel />

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-serif text-lg font-semibold text-primary">Subscription</h2>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-accent-soft p-4">
            <div>
              <div className="flex items-center gap-2 font-medium text-primary"><ShieldCheck className="h-4 w-4" /> {sub?.plan ?? "—"} · {sub?.status ?? "—"}</div>
              {sub?.current_period_end && <p className="mt-1 text-xs text-muted-foreground">Renews {new Date(sub.current_period_end).toLocaleDateString("en-IN")}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => nav("/pricing")}>Manage plan</Button>
              {sub?.status === "active" && <Button variant="destructive" onClick={cancelPlan} disabled={cancelling}>{cancelling && <Loader2 className="h-4 w-4 animate-spin" />}Cancel</Button>}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-serif text-lg font-semibold text-destructive">DPDP — Delete my data</h2>
          <p className="mt-2 text-sm text-muted-foreground">Permanently delete your matters, research notes, drafts, and usage history. This cannot be undone.</p>
          <Button variant="destructive" className="mt-4" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete all my data</Button>
        </section>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Confirm permanent deletion</DialogTitle><DialogDescription>This will remove all your matters, notes, drafts, and usage events. You will be signed out.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAll} disabled={deleting}>{deleting && <Loader2 className="h-4 w-4 animate-spin" />}Delete everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Settings;
