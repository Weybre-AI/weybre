import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Section = { h: string; p: string };
type Page = { id?: string; slug: string; title: string; intro: string; sections: Section[] };

const KNOWN_SLUGS = [
  "about", "terms", "privacy", "refund", "disclaimer", "security", "contact",
  "security-compliance", "trust", "security-measures", "newsroom", "blog",
];

const blank = (slug = ""): Page => ({ slug, title: "", intro: "", sections: [{ h: "", p: "" }] });

const AdminPages = () => {
  const [list, setList] = useState<{ id: string; slug: string; title: string; updated_at: string }[]>([]);
  const [editing, setEditing] = useState<Page | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const { data } = await supabase.from("cms_pages").select("id, slug, title, updated_at").order("slug");
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, []);

  const open = async (slug: string) => {
    const { data } = await supabase.from("cms_pages").select("*").eq("slug", slug).maybeSingle();
    if (data) {
      setEditing({ ...data, sections: Array.isArray(data.sections) ? (data.sections as Section[]) : [] });
    } else {
      setEditing(blank(slug));
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.slug || !editing.title) {
      toast({ title: "Slug and title are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("cms_pages").upsert({
      slug: editing.slug,
      title: editing.title,
      intro: editing.intro,
      sections: editing.sections,
    }, { onConflict: "slug" });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Page saved" });
    setEditing(null);
    reload();
  };

  const remove = async () => {
    if (!editing?.id) { setEditing(null); return; }
    if (!confirm("Delete this page override? It will revert to the built-in default.")) return;
    await supabase.from("cms_pages").delete().eq("id", editing.id);
    toast({ title: "Deleted" });
    setEditing(null);
    reload();
  };

  const updateSection = (i: number, key: "h" | "p", val: string) => {
    if (!editing) return;
    const sections = editing.sections.slice();
    sections[i] = { ...sections[i], [key]: val };
    setEditing({ ...editing, sections });
  };

  return (
    <AdminShell title="Pages">
      {!editing && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Edit the static legal and marketing pages. Empty pages fall back to built-in defaults.</p>
            <Button onClick={() => setEditing(blank())}><Plus className="h-4 w-4" /> New page</Button>
          </div>

          <Card className="p-4">
            <h2 className="mb-3 font-serif text-lg">Built-in slugs</h2>
            <div className="flex flex-wrap gap-2">
              {KNOWN_SLUGS.map((s) => {
                const overridden = list.some((p) => p.slug === s);
                return (
                  <Button key={s} variant={overridden ? "default" : "outline"} size="sm" onClick={() => open(s)}>
                    {s} {overridden && <span className="ml-1 text-[10px] opacity-70">edited</span>}
                  </Button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-serif text-lg">Custom overrides</h2>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom edits yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">/legal/{p.slug} · {new Date(p.updated_at).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => open(p.slug)}>Edit</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {editing && (
        <div className="max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>← Back</Button>
          <div className="grid gap-4">
            <div>
              <Label>Slug (URL: /legal/&lt;slug&gt;)</Label>
              <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} disabled={!!editing.id} />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>Intro</Label>
              <Textarea rows={3} value={editing.intro} onChange={(e) => setEditing({ ...editing, intro: e.target.value })} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Sections</Label>
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, sections: [...editing.sections, { h: "", p: "" }] })}>
                  <Plus className="h-4 w-4" /> Add section
                </Button>
              </div>
              <div className="space-y-3">
                {editing.sections.map((s, i) => (
                  <Card key={i} className="space-y-2 p-4">
                    <Input placeholder="Heading" value={s.h} onChange={(e) => updateSection(i, "h", e.target.value)} />
                    <Textarea placeholder="Body" rows={3} value={s.p} onChange={(e) => updateSection(i, "p", e.target.value)} />
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, sections: editing.sections.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Button>
              {editing.id && <Button variant="destructive" onClick={remove}><Trash2 className="h-4 w-4" /> Delete override</Button>}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminPages;
