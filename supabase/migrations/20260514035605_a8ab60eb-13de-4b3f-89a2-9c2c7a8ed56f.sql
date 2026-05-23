
CREATE TABLE public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY cms_pages_public_read ON public.cms_pages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY cms_pages_admin_insert ON public.cms_pages FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY cms_pages_admin_update ON public.cms_pages FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY cms_pages_admin_delete ON public.cms_pages FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER cms_pages_updated_at BEFORE UPDATE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.cms_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'blog',
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  author_name TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cms_posts_kind_pub_idx ON public.cms_posts(kind, published, published_at DESC);

ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cms_posts_public_read_published ON public.cms_posts FOR SELECT TO anon, authenticated USING (published = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY cms_posts_admin_insert ON public.cms_posts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY cms_posts_admin_update ON public.cms_posts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY cms_posts_admin_delete ON public.cms_posts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER cms_posts_updated_at BEFORE UPDATE ON public.cms_posts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
