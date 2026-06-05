import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, BookOpen, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Clause {
  id: string;
  title: string;
  clause_text: string;
  category: string | null;
  is_verified: boolean;
  tags: string[];
  created_at: string;
}

const ClauseLibrary = () => {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Form state for new clause
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("clause_library").select("*").order("created_at", { ascending: false });
    if (data) setClauses(data as Clause[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleAdd = async () => {
    if (!newTitle || !newText) {
      toast.error("Title and clause text are required");
      return;
    }

    const { error } = await supabase.from("clause_library").insert({
      title: newTitle,
      clause_text: newText,
      category: newCategory || "General",
      is_verified: false
    });

    if (error) toast.error("Failed to add clause");
    else {
      toast.success("Clause added to library");
      setOpen(false);
      setNewTitle(""); setNewText(""); setNewCategory("");
      void load();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clause_library").delete().eq("id", id);
    if (error) toast.error("Failed to delete clause");
    else {
      toast.success("Clause removed");
      void load();
    }
  };

  const filtered = clauses.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    (c.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell title="Clause Library">
      <div className="container max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search indemnity, limitation of liability..." 
              className="pl-9" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-glow"><Plus className="h-4 w-4 mr-2" /> Add Clause</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif">Add New Standard Clause</DialogTitle>
                <DialogDescription>Store verified legal language for your firm to use in drafts.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Clause Title</Label>
                  <Input placeholder="e.g. Mutual Indemnification" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input placeholder="e.g. Liability" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Clause Text</Label>
                  <Textarea 
                    placeholder="Enter the full legal text of the clause..." 
                    className="min-h-[200px] font-serif" 
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} className="bg-primary">Save to Library</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">Loading library...</div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground italic border-dashed">
              No clauses found. Start by adding your firm's standard language.
            </Card>
          ) : (
            filtered.map(c => (
              <Card key={c.id} className="p-5 overflow-hidden border-primary/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-4 w-4 text-accent" />
                      <h3 className="font-serif font-bold text-primary">{c.title}</h3>
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{c.category || 'General'}</Badge>
                      {c.is_verified && <Badge variant="default" className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>}
                    </div>
                    <blockquote className="border-l-4 border-muted bg-muted/10 p-3 italic text-sm text-foreground/80 leading-relaxed font-serif whitespace-pre-wrap">
                      {c.clause_text}
                    </blockquote>
                    <div className="flex gap-2">
                      {c.tags.map(t => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default ClauseLibrary;
