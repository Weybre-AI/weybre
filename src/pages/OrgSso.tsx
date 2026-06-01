import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useOrganizations } from "@/hooks/useOrganizations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Shield, Info } from "lucide-react";

type Provider = "google_workspace" | "saml";
type OrgRole = "owner" | "admin" | "member";
interface SsoRow {
  id: string; organization_id: string; provider: Provider;
  email_domain: string; sso_provider_id: string | null;
  default_role: OrgRole; is_active: boolean;
}

export default function OrgSso() {
  const { currentOrg } = useOrganizations();
  const [rows, setRows] = useState<SsoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>("google_workspace");
  const [domain, setDomain] = useState("");
  const [ssoProviderId, setSsoProviderId] = useState("");
  const [defaultRole, setDefaultRole] = useState<OrgRole>("member");

  const canEdit = currentOrg?.role === "owner" || currentOrg?.role === "admin";

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await (supabase as unknown).from("organization_sso")
      .select("id,organization_id,provider,email_domain,sso_provider_id,default_role,is_active")
      .eq("organization_id", currentOrg.id).order("created_at");
    setLoading(false);
    if (!error) setRows((data ?? []) as SsoRow[]);
  }, [currentOrg]);

  useEffect(() => { void load();   }, [load]);

  async function add() {
    if (!currentOrg || !domain.trim()) return;
    const { error } = await (supabase as unknown).from("organization_sso").insert({
      organization_id: currentOrg.id, provider,
      email_domain: domain.trim().toLowerCase().replace(/^@/, ""),
      sso_provider_id: provider === "saml" ? (ssoProviderId.trim() || null) : null,
      default_role: defaultRole,
    });
    if (error) { toast.error(error.message); return; }
    setDomain(""); setSsoProviderId(""); toast.success("SSO config added");
    void load();
  }
  async function toggle(r: SsoRow) {
    const { error } = await (supabase as unknown).from("organization_sso").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    void load();
  }
  async function remove(id: string) {
    const { error } = await (supabase as unknown).from("organization_sso").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(p => p.filter(r => r.id !== id));
  }

  return (
    <AppShell title="SSO">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:p-8">
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Shield className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-xl font-semibold">Single Sign-On</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Route users from your firm's email domain into <strong>{currentOrg?.name ?? "—"}</strong> automatically.
                Members are added with the configured default role on first sign-in.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <strong>Google Workspace</strong>: works out of the box with the managed Google sign-in — just enter your domain.{" "}
                  <strong>SAML</strong>: requires the platform admin to register your IdP metadata; once done, paste the returned provider id below.
                </div>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="mt-5 grid gap-3 sm:grid-cols-5">
              <div className="sm:col-span-1">
                <Label className="text-xs">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_workspace">Google Workspace</SelectItem>
                    <SelectItem value="saml">SAML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Email domain</Label>
                <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="firm.com" />
              </div>
              {provider === "saml" && (
                <div className="sm:col-span-2">
                  <Label className="text-xs">Supabase SSO provider id</Label>
                  <Input value={ssoProviderId} onChange={e => setSsoProviderId(e.target.value)} placeholder="uuid from platform admin" />
                </div>
              )}
              <div>
                <Label className="text-xs">Default role</Label>
                <Select value={defaultRole} onValueChange={(v) => setDefaultRole(v as OrgRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-5">
                <Button onClick={add} disabled={!domain.trim()}>Add SSO config</Button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : rows.length === 0 ? <p className="text-sm text-muted-foreground">No SSO configured.</p>
              : rows.map(r => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                  <Badge variant="secondary" className="capitalize">{r.provider.replace("_", " ")}</Badge>
                  <span className="font-mono text-sm">@{r.email_domain}</span>
                  <Badge variant="outline" className="capitalize">{r.default_role}</Badge>
                  {r.sso_provider_id && <span className="text-xs text-muted-foreground">id: {r.sso_provider_id.slice(0, 12)}…</span>}
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} disabled={!canEdit} />
                      <span className="text-xs">{r.is_active ? "Active" : "Disabled"}</span>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
