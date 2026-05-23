import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/safeHref";

type Post = {
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  author_name: string | null;
  published_at: string | null;
  kind: string;
};

const Post = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase
      .from("cms_posts")
      .select("title, excerpt, body, cover_image_url, author_name, published_at, kind, published")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle()
      .then(({ data }) => {
        setPost(data as Post | null);
        setLoading(false);
      });
  }, [slug]);

  return (
    <div className="min-h-screen bg-hero">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Button asChild variant="outline" size="sm">
            <Link to={post?.kind === "newsroom" ? "/legal/newsroom" : "/legal/blog"}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </header>
      <main className="container max-w-3xl py-12">
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {!loading && !post && (
          <div>
            <h1 className="font-serif text-3xl text-primary">Post not found</h1>
            <p className="mt-2 text-muted-foreground">This post may be unpublished or removed.</p>
          </div>
        )}
        {post && (
          <article>
            {post.published_at && (
              <p className="font-mono text-xs uppercase tracking-wider text-accent">
                {new Date(post.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                {post.author_name && <span className="ml-2 text-muted-foreground">· {post.author_name}</span>}
              </p>
            )}
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-primary md:text-5xl">{post.title}</h1>
            {post.excerpt && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>}
            {safeHref(post.cover_image_url) && (
              <img src={safeHref(post.cover_image_url)!} alt={post.title} className="mt-8 w-full rounded-xl border border-border" />
            )}
            <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-wrap text-base leading-relaxed text-foreground">
              {post.body}
            </div>
          </article>
        )}
      </main>
    </div>
  );
};

export default Post;
