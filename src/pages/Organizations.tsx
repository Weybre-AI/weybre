import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useOrganizations, OrgRole } from "@/hooks/useOrganizations";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, Building2, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";

interface Member { id: string; user_id: string; role: OrgRole; created_at: string; email?: string }
interface Invite { id: string; email: string; role: OrgRole; token: string; expires_at: string; accepted_at: string | null }

export default function Organizations() {
  const { user } = useAuth();
  const { orgs, currentOrg, setCurrentOrgId, createOrg, refresh, loading } = useOrganizations();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [inviting, setInviting] = useState(false);

  const isAdmin = currentOrg?.role === "owner" || currentOrg?.role === "admin";
  const isOwner = currentOrg?.role === "owner";

  useEffect(() => {
    if (!currentOrg) { setMembers([]); setInvites([]); return; }
    void loadOrg(currentOrg.id);
  }, [currentOrg?.id]);

  async function loadOrg(orgId: string) {
    const [mRes, iRes] = await Promise.all([
      (supabase as any).from("organization_members").select("id,user_id,role,created_at").eq("organization_id", orgId).order("created_at"),
      (supabase as any).from("organization_invites").select("id,email,role,token,expires_at,accepted_at").eq("organization_id", orgId).is("accepted_at", null).order("created_at", { ascending: false }),
    ]);
    if (!mRes.error) {
      const rows = (mRes.data ?? []) as Member[];
      // hydrate email for current user only (auth.users is not exposed)
      setMembers(rows.map(r => r.user_id === user?.id ? { ...r, email: user.email } : r));
    }
    if (!iRes.error) setInvites((iRes.data ?? []) as Invite[]);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const org = await createOrg(newName);
    setCreating(false);
    if (org) { setNewName(""); toast.success(`Created ${org.name}`); }
    else toast.error("Failed to create organization");
  }

  async function handleInvite() {
    if (!currentOrg || !inviteEmail.trim() || !user) return;
    setInviting(true);
    const { error } = await (supabase as any).from("organization_invites").insert({
      organization_id: currentOrg.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user.id,
    });
    setInviting(false);
    if (error) { toast.error(error.message); return; }
    setInviteEmail("");
    toast.success("Invite created");
    await loadOrg(currentOrg.id);
  }

  async function revokeInvite(id: string) {
    const { error } = await (supabase as any).from("organization_invites").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setInvites(p => p.filter(i => i.id !== id));
  }

  async function changeRole(memberId: string, role: OrgRole) {
    const { error } = await (supabase as any).from("organization_members").update({ role }).eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    setMembers(p => p.map(m => m.id === memberId ? { ...m, role } : m));
    toast.success("Role updated");
  }

  async function removeMember(memberId: string) {
    const { error } = await (supabase as any).from("organization_members").delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    setMembers(p => p.filter(m => m.id !== memberId));
    if (currentOrg) await refresh();
  }

  function copyInvite(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  return (
    <AppShell title="Organizations">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:p-8">
        {/* Switcher / create */}
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-semibold">Your organizations</h2>
              <p className="text-sm text-muted-foreground">Switch between firms you belong to, or create a new one.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/app/organizations/audit"><ScrollText className="mr-2 h-4 w-4" />Audit log</Link>
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button><Building2 className="mr-2 h-4 w-4" />New organization</Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create organization</DialogTitle></DialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="orgname">Name</Label>
                  <Input id="orgname" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Sharma & Associates" />
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={creating || !newName.trim()}>{creating ? "Creating…" : "Create"}</Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">You're not in any organization yet. Create one above.</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {orgs.map(o => (
                <button
                  key={o.id}
                  onClick={() => setCurrentOrgId(o.id)}
                  className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent/40 ${currentOrg?.id === o.id ? "border-primary bg-accent/30" : "border-border"}`}
                >
                  <div>
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground">/{o.slug}</div>
                  </div>
                  <Badge variant="secondary" className="capitalize">{o.role}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>

        {currentOrg && (
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="font-serif text-xl font-semibold">{currentOrg.name}</h2>
              <p className="text-sm text-muted-foreground">Manage members and invites.</p>
            </div>
            <Tabs defaultValue="members">
              <TabsList>
                <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
                <TabsTrigger value="invites">Pending invites ({invites.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="mt-4 space-y-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.email ?? m.user_id.slice(0, 8) + "…"}</div>
                      <div className="text-xs text-muted-foreground">Joined {new Date(m.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && m.user_id !== currentOrg.created_by ? (
                        <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as OrgRole)}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                      )}
                      {(isAdmin || m.user_id === user?.id) && m.user_id !== currentOrg.created_by && (
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="invites" className="mt-4 space-y-4">
                {isAdmin && (
                  <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="invemail" className="text-xs">Email</Label>
                      <Input id="invemail" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="lawyer@firm.com" />
                    </div>
                    <div>
                      <Label className="text-xs">Role</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                      <UserPlus className="mr-2 h-4 w-4" />Invite
                    </Button>
                  </div>
                )}
                {invites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invites.</p>
                ) : invites.map(i => (
                  <div key={i.id} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{i.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyInvite(i.token)}><Copy className="h-4 w-4" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" onClick={() => revokeInvite(i.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
