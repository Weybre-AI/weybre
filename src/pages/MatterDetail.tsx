import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BookOpen, FileText, Loader2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { toast } from "sonner";

const MatterDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [matter, setMatter] = useState<unknown>(null);
  const [notes, setNotes] = useState<unknown[]>([]);
  const [drafts, setDrafts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const [{ data: m }, { data: n }, { data: d }] = await Promise.all([
        supabase.from("matters").select("*").eq("id", id).maybeSingle(),
        supabase.from("research_notes").select("*").eq("matter_id", id).order("created_at", { ascending: false }),
        supabase.from("drafts").select("*").eq("matter_id", id).order("created_at", { ascending: false }),
      ]);
      setMatter(m); setNotes(n ?? []); setDrafts(d ?? []); setLoading(false);
    })().catch(err => {
      console.error("Matter detail load error:", err);
      toast.error("Failed to load matter");
      setLoading(false);
    });
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
    } catch (err: unknown) {
      toast.error("Export failed", { description: err?.message });
    } finally { setExporting(false); }
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
          </div>
        </div>

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
