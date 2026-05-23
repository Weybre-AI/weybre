import { useEffect, useState } from "react";
import { useM365 } from "@/hooks/useM365";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar, Cloud, MessageSquare, FileSpreadsheet, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { safeHref } from "@/lib/safeHref";

export function M365IntegrationPanel() {
  const { connected, loading, status, connectMicrosoft, disconnectMicrosoft, invoke, refreshStatus } = useM365();
  const [teams, setTeams] = useState<{ id: string; displayName: string }[]>([]);
  const [channels, setChannels] = useState<{ id: string; displayName: string }[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string; webUrl: string }[]>([]);
  const [teamId, setTeamId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [teamsMsg, setTeamsMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    (async () => {
      const [t, s] = await Promise.all([
        invoke<{ teams: { id: string; displayName: string }[] }>({ action: "list_teams" }),
        invoke<{ sites: { id: string; name: string; webUrl: string }[] }>({ action: "list_sites" }),
      ]);
      if (t.data?.teams) setTeams(t.data.teams);
      if (s.data?.sites) setSites(s.data.sites);
    })();
  }, [connected, invoke]);

  useEffect(() => {
    if (!teamId) { setChannels([]); return; }
    invoke<{ channels: { id: string; displayName: string }[] }>({ action: "list_channels", team_id: teamId })
      .then(({ data }) => setChannels(data?.channels ?? []));
  }, [teamId, invoke]);

  const postTeams = async () => {
    if (!teamsMsg.trim() || !teamId || !channelId) {
      toast.error("Select a team, channel, and enter a message");
      return;
    }
    setBusy("teams");
    const { error } = await invoke({ action: "post_teams_message", team_id: teamId, channel_id: channelId, message: teamsMsg });
    setBusy(null);
    if (error) toast.error("Teams post failed", { description: error });
    else { toast.success("Posted to Teams"); setTeamsMsg(""); }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-semibold text-primary">Microsoft 365</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Link your work Microsoft account for Outlook hearings, OneDrive drafts, Teams updates, and SharePoint files.
          </p>
          {connected && status.ms_email && (
            <p className="mt-2 text-sm font-medium text-foreground">
              {status.ms_name ?? status.ms_email}
              <span className="ml-2 text-xs text-muted-foreground">({status.ms_email})</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button variant="outline" size="sm" onClick={() => refreshStatus()}>Refresh</Button>
              <Button variant="outline" size="sm" onClick={() => disconnectMicrosoft()}>Disconnect</Button>
            </>
          ) : (
            <Button size="sm" className="bg-primary" onClick={() => connectMicrosoft()}>
              Connect Microsoft 365
            </Button>
          )}
        </div>
      </div>

      {!connected && (
        <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          Sign in with your Microsoft work account (e.g. <span className="font-medium text-foreground">you@lawfirm.com</span>).
          Weybre connects on your behalf — you never enter API keys or secrets here.
        </p>
      )}

      {connected && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2 font-medium text-primary">
              <Cloud className="h-4 w-4 text-accent" /> OneDrive &amp; Outlook
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> Hearings → Outlook from Matters</li>
              <li className="flex items-center gap-2"><Cloud className="h-3.5 w-3.5" /> Drafts → OneDrive export</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2 font-medium text-primary">
              <MessageSquare className="h-4 w-4 text-accent" /> Microsoft Teams
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Team</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select value={channelId} onValueChange={setChannelId} disabled={!teamId}>
                  <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                  <SelectContent>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Brief update for your firm channel…"
                value={teamsMsg}
                onChange={(e) => setTeamsMsg(e.target.value)}
                rows={3}
              />
              <Button size="sm" onClick={postTeams} disabled={busy === "teams"}>
                {busy === "teams" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post to Teams
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2 font-medium text-primary">
              <FileSpreadsheet className="h-4 w-4 text-accent" /> SharePoint
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label>Site</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="Select SharePoint site" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {siteId && safeHref(sites.find((s) => s.id === siteId)?.webUrl) && (
                <Button variant="outline" size="sm" asChild>
                  <a href={safeHref(sites.find((s) => s.id === siteId)!.webUrl)!} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open site
                  </a>
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Export drafts to SharePoint from the draft editor (site picker coming next). Files land in /Weybre AI/.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
