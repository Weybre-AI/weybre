import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Plus, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const TEMPLATES = [
  { key: "nda", label: "Non-Disclosure Agreement", desc: "Mutual or one-way NDA for business discussions." },
  { key: "employment", label: "Employment Agreement", desc: "Indian-law employment with notice, IP, non-compete." },
  { key: "service", label: "Service Agreement", desc: "Independent contractor / consultancy agreement." },
  { key: "legal_notice", label: "Legal Notice", desc: "Pre-litigation notice (e.g. Section 138 NI Act)." },
  { key: "reply_notice", label: "Reply to Legal Notice", desc: "Defensive reply with denial and rebuttal." },
  { key: "vakalatnama", label: "Vakalatnama", desc: "Standard authorization for advocate representation." },
];

const Drafts = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState<string>("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("drafts").select("*").eq("user_id", user.id).order("updated_at", { ascending: false })
      .then(({ data }) => { setDrafts(data ?? []); setLoading(false); });
  }, [user]);

  const create = async () => {
    if (!user || !tpl || !title.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from("drafts").insert({
      user_id: user.id, template: tpl, title: title.trim(), content: "",
    }).select("id").single();
    if (error) { toast.error(error.message); setCreating(false); return; }
    nav(`/app/drafts/${data.id}`);
  };

  return (
    <AppShell title="Drafts" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-glow"><Plus className="h-4 w-4" /> New draft</Button></DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-serif">Choose a template</DialogTitle><DialogDescription>AI will draft clause-by-clause once you provide the details.</DialogDescription></DialogHeader>
          <div className="grid gap-2 md:grid-cols-2">
            {TEMPLATES.map(t => (
              <button key={t.key} onClick={() => setTpl(t.key)} className={`rounded-lg border p-3 text-left transition-colors ${tpl === t.key ? "border-accent bg-accent-soft" : "border-border bg-card hover:border-accent/40"}`}>
                <div className="font-serif text-sm font-semibold text-primary">{t.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.desc}</div>
              </button>
            ))}
          </div>
          <div className="space-y-1.5"><Label>Draft title</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. NDA — Acme Corp x Beta Pvt Ltd" /></div>
          <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={create} disabled={creating || !tpl || !title.trim()}>{creating && <Loader2 className="h-4 w-4 animate-spin" />}Open editor</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      <div className="container max-w-5xl px-4 py-6 sm:py-8">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : drafts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-accent" />
            <h3 className="mt-4 font-serif text-xl font-semibold text-primary">Generate your first contract</h3>
            <p className="mt-1 text-sm text-muted-foreground">Pick a template, answer a few questions, and let AI handle the boilerplate.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map(d => (
              <Link key={d.id} to={`/app/drafts/${d.id}`} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><FileText className="h-4 w-4" /></div>
                  <div>
                    <p className="font-serif font-semibold text-primary">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{TEMPLATES.find(t => t.key === d.template)?.label ?? d.template}</p>
                  </div>
                </div>
                <span className="font-mono text-[0.7rem] text-muted-foreground">{new Date(d.updated_at).toLocaleDateString("en-IN")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Drafts;
