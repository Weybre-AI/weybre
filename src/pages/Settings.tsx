import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2, Trash2, ShieldCheck, Key, Webhook, Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApiKeys } from "@/hooks/useApiKeys";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  full_name: string | null;
  firm_name: string | null;
  bar_council_number: string | null;
  phone: string | null;
}

const Settings = () => {
  const { user, signOut } = useAuth();
  const { sub } = useSubscription();
  const nav = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Developer Platform Hooks
  const { keys, createKey, revokeKey, loading: keysLoading } = useApiKeys(orgId);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(p as UserProfile);
      
      const { data: m } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (m) setOrgId(m.organization_id);
      
      setLoading(false);
    })();
  }, [user]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Enter a name for the API key");
      return;
    }
    const key = await createKey(newKeyName, ["research:read", "draft:write"]);
    if (key) {
      setRevealedKey(key);
      setNewKeyName("");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

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

  const exportData = async () => {
    if (!user) return;
    try {
      const [pRes, mRes, nRes, dRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("matters").select("*").eq("user_id", user.id),
        supabase.from("research_notes").select("*").eq("user_id", user.id),
        supabase.from("drafts").select("*").eq("user_id", user.id),
      ]);
      const data = {
        profile: pRes.data,
        matters: mRes.data,
        notes: nRes.data,
        drafts: dRes.data,
        exported_at: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `weybre_export_${new Date().toISOString().split("T")[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Data export complete");
    } catch (e) {
      toast.error("Data export failed", { description: (e as Error)?.message });
    }
  };

  const deleteAll = async () => {
    if (!user) return;
    setDeleting(true);
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
            <div className="space-y-1.5"><Label>Full name</Label><Input value={profile?.full_name ?? ""} onChange={e => setProfile(p => p ? { ...p, full_name: e.target.value } : null)} /></div>
            <div className="space-y-1.5"><Label>Firm</Label><Input value={profile?.firm_name ?? ""} onChange={e => setProfile(p => p ? { ...p, firm_name: e.target.value } : null)} /></div>
            <div className="space-y-1.5"><Label>Bar Council number</Label><Input value={profile?.bar_council_number ?? ""} onChange={e => setProfile(p => p ? { ...p, bar_council_number: e.target.value } : null)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={profile?.phone ?? ""} onChange={e => setProfile(p => p ? { ...p, phone: e.target.value } : null)} /></div>
          </div>
          <div className="mt-5 flex justify-end"><Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary-glow">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button></div>
        </section>

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

        {/* Initiative 5: Developer Platform Portal */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-lg font-semibold text-primary">Developer Portal</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Manage API keys and webhooks to integrate Weybre AI into your firm's internal tools.</p>
          
          <div className="mt-6 space-y-6">
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Create New API Key</Label>
              <div className="mt-2 flex gap-2">
                <Input placeholder="e.g. Internal Research Tool" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="max-w-sm" />
                <Button onClick={handleCreateKey} size="sm" className="bg-accent hover:bg-accent/90"><Plus className="h-4 w-4 mr-1" /> Create</Button>
              </div>
            </div>

            {revealedKey && (
              <div className="rounded-lg bg-accent/10 border border-accent/20 p-4 animate-in fade-in zoom-in-95">
                <p className="text-xs font-bold text-accent uppercase tracking-widest">New Secret Key Created</p>
                <div className="mt-2 flex items-center justify-between gap-4 bg-background border rounded px-3 py-2">
                  <code className="font-mono text-sm break-all">{revealedKey}</code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(revealedKey)}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground font-medium italic">Make sure to copy this key now. You won't be able to see it again for security reasons.</p>
                <Button variant="link" size="sm" onClick={() => setRevealedKey(null)} className="mt-2 h-auto p-0 text-accent">I've copied it</Button>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Active Keys</Label>
              {keys.length === 0 ? (
                <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">No active API keys</div>
              ) : (
                <div className="grid gap-2">
                  {keys.map(k => (
                    <div key={k.id} className="flex items-center justify-between rounded border p-3 bg-muted/5">
                      <div>
                        <p className="font-medium text-sm">{k.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{k.key_prefix}••••••••</code>
                          <span className="text-[10px] text-muted-foreground">Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => revokeKey(k.id)}><X className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif text-sm font-semibold text-primary">Webhooks</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Receive real-time notifications for completed jobs, new judgments, or billing events.</p>
              <Button variant="outline" size="sm" className="mt-3" disabled>Configure Webhooks (Coming Soon)</Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-serif text-lg font-semibold text-destructive">DPDP — Data Privacy</h2>
          <p className="mt-2 text-sm text-muted-foreground">Export your data in a machine-readable format, or permanently delete your matters, research notes, drafts, and usage history. Deletion cannot be undone.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={exportData}>Export my data (JSON)</Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete all my data</Button>
          </div>
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

