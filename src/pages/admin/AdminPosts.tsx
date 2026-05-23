import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Post = {
  id?: string;
  slug: string;
  kind: "blog" | "newsroom";
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string;
  author_name: string;
  published: boolean;
  published_at: string | null;
};

const blank = (): Post => ({
  slug: "", kind: "blog", title: "", excerpt: "", body: "",
  cover_image_url: "", author_name: "", published: false, published_at: null,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const AdminPosts = () => {
  const [list, setList] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const { data } = await supabase.from("cms_posts").select("*").order("updated_at", { ascending: false });
    setList((data ?? []) as Post[]);
  };
  useEffect(() => { reload(); }, []);

  const save = async (publishNow?: boolean) => {
    if (!editing) return;
    if (!editing.title) { toast({ title: "Title required", variant: "destructive" }); return; }
    const slug = editing.slug || slugify(editing.title);
    const willPublish = publishNow ?? editing.published;
    setSaving(true);
    const payload = {
      slug,
      kind: editing.kind,
      title: editing.title,
      excerpt: editing.excerpt,
      body: editing.body,
      cover_image_url: editing.cover_image_url || null,
      author_name: editing.author_name || null,
      published: willPublish,
      published_at: willPublish ? (editing.published_at ?? new Date().toISOString()) : null,
    };
    const { error } = editing.id
      ? await supabase.from("cms_posts").update(payload).eq("id", editing.id)
      : await supabase.from("cms_posts").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: willPublish ? "Published" : "Saved as draft" });
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("cms_posts").delete().eq("id", id);
    toast({ title: "Deleted" });
    reload();
  };

  return (
    <AdminShell title="Posts">
      {!editing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Publish blog posts and newsroom updates. Visible at /legal/blog and /legal/newsroom when published.</p>
            <Button onClick={() => setEditing(blank())}><Plus className="h-4 w-4" /> New post</Button>
          </div>
          <Card className="divide-y divide-border">
            {list.length === 0 && <p className="p-6 text-sm text-muted-foreground">No posts yet.</p>}
            {list.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider">{p.kind}</span>
                    {p.published ? (
                      <span className="inline-flex items-center gap-1 text-xs text-accent"><Eye className="h-3 w-3" /> Published</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><EyeOff className="h-3 w-3" /> Draft</span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">/posts/{p.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id!)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {editing && (
        <div className="max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>← Back</Button>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kind</Label>
                <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v as "blog" | "newsroom" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog">Blog / Perspectives</SelectItem>
                    <SelectItem value="newsroom">Newsroom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Slug (auto from title if empty)</Label>
                <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} placeholder="my-post" />
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>Excerpt (shown on listing)</Label>
              <Textarea rows={2} value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Author name</Label>
                <Input value={editing.author_name} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} />
              </div>
              <div>
                <Label>Cover image URL</Label>
                <Input value={editing.cover_image_url} onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Body</Label>
              <Textarea rows={16} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder="Write the full post. Plain text or simple HTML." />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => save(false)} disabled={saving} variant="outline"><Save className="h-4 w-4" /> Save draft</Button>
              <Button onClick={() => save(true)} disabled={saving}><Eye className="h-4 w-4" /> {editing.published ? "Update published" : "Publish"}</Button>
              {editing.published && (
                <Button variant="ghost" onClick={() => save(false)} disabled={saving}><EyeOff className="h-4 w-4" /> Unpublish</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminPosts;
