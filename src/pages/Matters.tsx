import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FolderOpen, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const Matters = () => {
  const { user } = useAuth();
  const [matters, setMatters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("matters").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMatters(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("matters").insert({ user_id: user.id, name: name.trim(), client, description });
    if (error) { toast.error(error.message); setCreating(false); return; }
    toast.success("Matter created");
    setName(""); setClient(""); setDescription(""); setOpen(false); setCreating(false);
    load();
  };

  return (
    <AppShell title="Matters" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-primary hover:bg-primary-glow"><Plus className="h-4 w-4" /> New matter</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Create matter</DialogTitle><DialogDescription>Group related research and drafts together.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Sharma v. Mehta" /></div>
            <div className="space-y-1.5"><Label>Client</Label><Input value={client} onChange={e=>setClient(e.target.value)} placeholder="A. Sharma" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Brief overview of the matter" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={create} disabled={creating || !name.trim()}>{creating && <Loader2 className="h-4 w-4 animate-spin" />}Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      <div className="container max-w-5xl px-4 py-6 sm:py-8">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : matters.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {matters.map(m => (
              <Link key={m.id} to={`/app/matters/${m.id}`} className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-md">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><FolderOpen className="h-4 w-4" /></div>
                <h2 className="font-serif text-lg font-semibold text-primary group-hover:text-primary-glow">{m.name}</h2>
                {m.client && <p className="mt-0.5 text-xs text-muted-foreground">{m.client}</p>}
                {m.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
                <p className="mt-3 font-mono text-[0.7rem] text-muted-foreground">{new Date(m.created_at).toLocaleDateString("en-IN")}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

const EmptyState = () => (
  <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
    <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
    <h2 className="mt-4 font-serif text-xl font-semibold text-primary">No matters yet</h2>
    <p className="mt-1 text-sm text-muted-foreground">Create your first matter to organize research and drafts.</p>
  </div>
);

export default Matters;
