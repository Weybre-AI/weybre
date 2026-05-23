import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useM365 } from "@/hooks/useM365";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BookOpen, FileText, Loader2, FileDown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { toast } from "sonner";

const MatterDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { connected: m365Connected, createCalendarEvent, connectMicrosoft } = useM365();
  const [matter, setMatter] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [hearingDate, setHearingDate] = useState("");
  const [hearingTime, setHearingTime] = useState("10:00");
  const [hearingLocation, setHearingLocation] = useState("");
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const [{ data: m }, { data: n }, { data: d }] = await Promise.all([
        supabase.from("matters").select("*").eq("id", id).maybeSingle(),
        supabase.from("research_notes").select("*").eq("matter_id", id).order("created_at", { ascending: false }),
        supabase.from("drafts").select("*").eq("matter_id", id).order("created_at", { ascending: false }),
      ]);
      setMatter(m); setNotes(n ?? []); setDrafts(d ?? []); setLoading(false);
    })();
  }, [id, user]);

  const exportMatter = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-matter", {
        body: { matter_id: id, format: "pdf" },
      });
      if (error) throw error;
      const blob = new Blob([Uint8Array.from(atob(data.file), c => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${matter?.name ?? "matter"}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Export failed", { description: err?.message });
    } finally { setExporting(false); }
  };

  const syncHearingToCalendar = async () => {
    if (!hearingDate) { toast.error("Select a hearing date"); return; }
    if (!m365Connected) {
      toast.info("Connecting to Microsoft 365…");
      connectMicrosoft();
      return;
    }
    setSyncingCalendar(true);
    try {
      const startDt = `${hearingDate}T${hearingTime}:00`;
      // Default hearing duration: 1 hour
      const [h, m] = hearingTime.split(":").map(Number);
      const endHour = String(h + 1).padStart(2, "0");
      const endDt = `${hearingDate}T${endHour}:${String(m).padStart(2, "0")}:00`;

      const webLink = await createCalendarEvent({
        subject: `Hearing — ${matter.name}${matter.client ? ` (${matter.client})` : ""}`,
        body: `Matter: ${matter.name}\nClient: ${matter.client ?? "—"}\n\nCreated by Weybre AI`,
        start: startDt,
        end: endDt,
        location: hearingLocation || undefined,
        timeZone: "Asia/Kolkata",
        matterId: id,
      });

      toast.success("Added to Outlook Calendar", {
        action: { label: "Open", onClick: () => window.open(webLink, "_blank", "noopener,noreferrer") },
      });
      setCalendarOpen(false);
      setHearingDate("");
      setHearingTime("10:00");
      setHearingLocation("");
    } catch (err: any) {
      toast.error("Calendar sync failed", { description: err?.message });
    } finally {
      setSyncingCalendar(false);
    }
  };

  if (loading) return <AppShell><div className="flex h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div></AppShell>;
  if (!matter) return <AppShell><div className="container py-10">Matter not found.</div></AppShell>;

  return (
    <AppShell>
      <div className="container max-w-5xl px-4 py-6 sm:py-8">
        <Link to="/app/matters" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All matters</Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{matter.name}</h1>
            {matter.client && <p className="mt-1 text-sm text-muted-foreground">{matter.client}</p>}
            {matter.description && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{matter.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" onClick={exportMatter} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => setCalendarOpen(true)} title={m365Connected ? "Add hearing to Outlook Calendar" : "Connect Microsoft 365 to sync hearings"}>
            <Calendar className="h-4 w-4" />
            Outlook
          </Button>
          </div>
        </div>

        {/* Outlook Calendar dialog */}
        <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Add hearing to Outlook Calendar</DialogTitle>
              <DialogDescription>Creates an event in your Microsoft Outlook calendar for this matter.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hearing-date">Hearing date</Label>
                <Input id="hearing-date" type="date" value={hearingDate} onChange={e => setHearingDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hearing-time">Time (IST)</Label>
                <Input id="hearing-time" type="time" value={hearingTime} onChange={e => setHearingTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hearing-location">Court / location (optional)</Label>
                <Input id="hearing-location" placeholder="e.g. Delhi High Court, Court No. 5" value={hearingLocation} onChange={e => setHearingLocation(e.target.value)} />
              </div>
              {!m365Connected && (
                <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  You'll be redirected to sign in with Microsoft to connect your Outlook calendar.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCalendarOpen(false)}>Cancel</Button>
              <Button onClick={syncHearingToCalendar} disabled={syncingCalendar || !hearingDate}>
                {syncingCalendar && <Loader2 className="h-4 w-4 animate-spin" />}
                {m365Connected ? "Add to Calendar" : "Connect & Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold text-primary"><BookOpen className="h-4 w-4 text-accent" /> Research notes ({notes.length})</h2>
          {notes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">No saved research yet.</p>
          ) : (
            <div className="space-y-3">
              {notes.map(n => (
                <div key={n.id} className="rounded-lg border border-border bg-card p-5">
                  <p className="font-serif text-base font-semibold text-primary">{n.query}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{n.answer}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-[0.7rem] text-muted-foreground">{new Date(n.created_at).toLocaleString("en-IN")}</span>
                    <AiDisclaimer />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold text-primary"><FileText className="h-4 w-4 text-accent" /> Drafts ({drafts.length})</h2>
          {drafts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">No drafts in this matter yet.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map(d => (
                <Link key={d.id} to={`/app/drafts/${d.id}`} className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-serif font-semibold text-primary">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.template}</p>
                    </div>
                    <span className="font-mono text-[0.7rem] text-muted-foreground">{new Date(d.updated_at).toLocaleDateString("en-IN")}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
};

export default MatterDetail;
