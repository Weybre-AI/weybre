
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'lawyer');
CREATE TYPE public.plan_tier AS ENUM ('solo', 'firm');
CREATE TYPE public.sub_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'incomplete');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  firm_name TEXT,
  practice_areas TEXT[],
  bar_council_number TEXT,
  phone TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan plan_tier NOT NULL DEFAULT 'solo',
  status sub_status NOT NULL DEFAULT 'incomplete',
  razorpay_customer_id TEXT,
  razorpay_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============ JUDGMENTS (case-law corpus) ============
CREATE TABLE public.judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  citation TEXT,
  neutral_citation TEXT,
  court TEXT NOT NULL DEFAULT 'Supreme Court of India',
  bench TEXT,
  judges TEXT[],
  decision_date DATE,
  disposition TEXT,
  headnote TEXT,
  summary TEXT,
  issues TEXT[],
  full_text TEXT,
  source_url TEXT,
  embedding vector(1536),
  tsv tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.judgments ENABLE ROW LEVEL SECURITY;

CREATE INDEX judgments_tsv_idx ON public.judgments USING GIN (tsv);
CREATE INDEX judgments_embedding_idx ON public.judgments
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX judgments_decision_date_idx ON public.judgments (decision_date DESC);

CREATE OR REPLACE FUNCTION public.judgments_tsv_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.headnote, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.full_text, '')), 'C');
  RETURN NEW;
END $$;

CREATE TRIGGER judgments_tsv_update
BEFORE INSERT OR UPDATE ON public.judgments
FOR EACH ROW EXECUTE FUNCTION public.judgments_tsv_trigger();

-- ============ MATTERS ============
CREATE TABLE public.matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  client TEXT,
  area TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
CREATE INDEX matters_user_idx ON public.matters (user_id, created_at DESC);

-- ============ RESEARCH NOTES ============
CREATE TABLE public.research_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX research_notes_user_idx ON public.research_notes (user_id, created_at DESC);
CREATE INDEX research_notes_matter_idx ON public.research_notes (matter_id);

-- ============ DRAFTS ============
CREATE TABLE public.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  template TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE INDEX drafts_user_idx ON public.drafts (user_id, created_at DESC);

-- ============ USAGE EVENTS ============
CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX usage_events_user_idx ON public.usage_events (user_id, created_at DESC);

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- subscriptions
CREATE POLICY "subs_select_own" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- judgments â€” readable by all authenticated users
CREATE POLICY "judgments_select_authed" ON public.judgments FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "judgments_admin_write" ON public.judgments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- matters
CREATE POLICY "matters_select_own" ON public.matters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "matters_insert_own" ON public.matters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "matters_update_own" ON public.matters FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "matters_delete_own" ON public.matters FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- research_notes
CREATE POLICY "notes_select_own" ON public.research_notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notes_insert_own" ON public.research_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON public.research_notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON public.research_notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- drafts
CREATE POLICY "drafts_select_own" ON public.drafts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "drafts_insert_own" ON public.drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "drafts_update_own" ON public.drafts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "drafts_delete_own" ON public.drafts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- usage_events
CREATE POLICY "usage_select_own" ON public.usage_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER subscriptions_updated BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER matters_updated BEFORE UPDATE ON public.matters
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER drafts_updated BEFORE UPDATE ON public.drafts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile + lawyer role + subscription stub on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'solo', 'incomplete')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ HYBRID SEARCH RPC ============
CREATE OR REPLACE FUNCTION public.search_judgments(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  citation TEXT,
  neutral_citation TEXT,
  court TEXT,
  bench TEXT,
  judges TEXT[],
  decision_date DATE,
  headnote TEXT,
  summary TEXT,
  similarity FLOAT,
  rank FLOAT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH semantic AS (
    SELECT j.id, 1 - (j.embedding <=> query_embedding) AS similarity
    FROM public.judgments j
    WHERE j.embedding IS NOT NULL
    ORDER BY j.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  keyword AS (
    SELECT j.id, ts_rank(j.tsv, plainto_tsquery('english', query_text)) AS rank
    FROM public.judgments j
    WHERE j.tsv @@ plainto_tsquery('english', query_text)
    ORDER BY rank DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(s.id, k.id) AS id,
      COALESCE(s.similarity, 0) * 0.6 + COALESCE(k.rank, 0) * 0.4 AS score,
      COALESCE(s.similarity, 0) AS similarity,
      COALESCE(k.rank, 0) AS rank
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.id = k.id
  )
  SELECT j.id, j.title, j.citation, j.neutral_citation, j.court, j.bench,
         j.judges, j.decision_date, j.headnote, j.summary,
         c.similarity, c.rank
  FROM combined c
  JOIN public.judgments j ON j.id = c.id
  ORDER BY c.score DESC
  LIMIT match_count;
$$;

ALTER FUNCTION public.judgments_tsv_trigger() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- Fix subscriptions RLS: allow users to insert/update their own subscription rows.
-- The signup trigger runs as SECURITY DEFINER so it bypasses RLS, but the user-facing
-- "start trial" upsert from Pricing page needs INSERT + UPDATE policies.

CREATE POLICY "subs_insert_own"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subs_update_own"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure updated_at trigger exists on subscriptions
DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS judgments_external_id_uniq
  ON public.judgments (external_id)
  WHERE external_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.search_judgments(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  citation TEXT,
  neutral_citation TEXT,
  court TEXT,
  bench TEXT,
  judges TEXT[],
  decision_date DATE,
  headnote TEXT,
  summary TEXT,
  similarity FLOAT,
  rank FLOAT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH normalized AS (
    SELECT
      trim(query_text) AS q,
      websearch_to_tsquery('english', trim(query_text)) AS webq,
      plainto_tsquery('english', trim(query_text)) AS plainq
  ),
  semantic AS (
    SELECT j.id, 1 - (j.embedding <=> query_embedding) AS similarity
    FROM public.judgments j, normalized n
    WHERE j.embedding IS NOT NULL
      AND vector_norm(query_embedding) > 0
    ORDER BY j.embedding <=> query_embedding
    LIMIT match_count * 4
  ),
  keyword AS (
    SELECT
      j.id,
      GREATEST(
        ts_rank_cd(j.tsv, n.webq),
        ts_rank_cd(j.tsv, n.plainq)
      ) AS rank
    FROM public.judgments j, normalized n
    WHERE j.tsv @@ n.webq OR j.tsv @@ n.plainq
    ORDER BY rank DESC
    LIMIT match_count * 6
  ),
  fuzzy AS (
    SELECT
      j.id,
      GREATEST(
        similarity(j.title, n.q),
        similarity(coalesce(j.headnote, ''), n.q),
        similarity(coalesce(j.summary, ''), n.q)
      ) AS rank
    FROM public.judgments j, normalized n
    WHERE
      j.title % n.q
      OR coalesce(j.headnote, '') % n.q
      OR coalesce(j.summary, '') % n.q
      OR j.title ILIKE '%' || n.q || '%'
      OR coalesce(j.headnote, '') ILIKE '%' || n.q || '%'
      OR coalesce(j.summary, '') ILIKE '%' || n.q || '%'
    ORDER BY rank DESC
    LIMIT match_count * 6
  ),
  combined AS (
    SELECT id, MAX(score) AS score, MAX(similarity) AS similarity, MAX(rank) AS rank
    FROM (
      SELECT id, similarity * 0.60 AS score, similarity, 0::float AS rank FROM semantic
      UNION ALL
      SELECT id, rank * 1.00 AS score, 0::float AS similarity, rank FROM keyword
      UNION ALL
      SELECT id, rank * 0.65 AS score, 0::float AS similarity, rank FROM fuzzy
    ) r
    GROUP BY id
  )
  SELECT j.id, j.title, j.citation, j.neutral_citation, j.court, j.bench,
         j.judges, j.decision_date, j.headnote, j.summary,
         c.similarity, c.rank
  FROM combined c
  JOIN public.judgments j ON j.id = c.id
  ORDER BY c.score DESC NULLS LAST, j.decision_date DESC NULLS LAST
  LIMIT match_count;
$$;
CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.search_judgments(
  query_text TEXT,
  query_embedding extensions.vector(1536),
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  citation TEXT,
  neutral_citation TEXT,
  court TEXT,
  bench TEXT,
  judges TEXT[],
  decision_date DATE,
  headnote TEXT,
  summary TEXT,
  similarity FLOAT,
  rank FLOAT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH normalized AS (
    SELECT
      trim(query_text) AS q,
      websearch_to_tsquery('english', trim(query_text)) AS webq,
      plainto_tsquery('english', trim(query_text)) AS plainq
  ),
  semantic AS (
    SELECT j.id, 1 - (j.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
    FROM public.judgments j, normalized n
    WHERE j.embedding IS NOT NULL
      AND extensions.vector_norm(query_embedding) > 0
    ORDER BY j.embedding OPERATOR(extensions.<=>) query_embedding
    LIMIT match_count * 4
  ),
  keyword AS (
    SELECT
      j.id,
      GREATEST(
        ts_rank_cd(j.tsv, n.webq),
        ts_rank_cd(j.tsv, n.plainq)
      ) AS rank
    FROM public.judgments j, normalized n
    WHERE j.tsv @@ n.webq OR j.tsv @@ n.plainq
    ORDER BY rank DESC
    LIMIT match_count * 6
  ),
  fuzzy AS (
    SELECT
      j.id,
      GREATEST(
        extensions.similarity(j.title, n.q),
        extensions.similarity(coalesce(j.headnote, ''), n.q),
        extensions.similarity(coalesce(j.summary, ''), n.q)
      ) AS rank
    FROM public.judgments j, normalized n
    WHERE
      j.title OPERATOR(extensions.%) n.q
      OR coalesce(j.headnote, '') OPERATOR(extensions.%) n.q
      OR coalesce(j.summary, '') OPERATOR(extensions.%) n.q
      OR j.title ILIKE '%' || n.q || '%'
      OR coalesce(j.headnote, '') ILIKE '%' || n.q || '%'
      OR coalesce(j.summary, '') ILIKE '%' || n.q || '%'
    ORDER BY rank DESC
    LIMIT match_count * 6
  ),
  combined AS (
    SELECT id, MAX(score) AS score, MAX(similarity) AS similarity, MAX(rank) AS rank
    FROM (
      SELECT id, similarity * 0.60 AS score, similarity, 0::float AS rank FROM semantic
      UNION ALL
      SELECT id, rank * 1.00 AS score, 0::float AS similarity, rank FROM keyword
      UNION ALL
      SELECT id, rank * 0.65 AS score, 0::float AS similarity, rank FROM fuzzy
    ) r
    GROUP BY id
  )
  SELECT j.id, j.title, j.citation, j.neutral_citation, j.court, j.bench,
         j.judges, j.decision_date, j.headnote, j.summary,
         c.similarity, c.rank
  FROM combined c
  JOIN public.judgments j ON j.id = c.id
  ORDER BY c.score DESC NULLS LAST, j.decision_date DESC NULLS LAST
  LIMIT match_count;
$$;
CREATE TABLE public.draft_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  extracted_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.draft_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_draft_attachments_draft_id ON public.draft_attachments(draft_id);
CREATE INDEX idx_draft_attachments_user_id ON public.draft_attachments(user_id);

CREATE TRIGGER update_draft_attachments_updated_at
BEFORE UPDATE ON public.draft_attachments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE POLICY "draft_attachments_select_own"
ON public.draft_attachments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "draft_attachments_insert_own"
ON public.draft_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.drafts d
    WHERE d.id = draft_id AND d.user_id = auth.uid()
  )
);

CREATE POLICY "draft_attachments_update_own"
ON public.draft_attachments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "draft_attachments_delete_own"
ON public.draft_attachments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'draft-documents',
  'draft-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'application/rtf'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "draft_documents_read_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "draft_documents_upload_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "draft_documents_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "draft_documents_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS razorpay_order_id text,
ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
ADD COLUMN IF NOT EXISTS checkout_status text NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_payment_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid,
  provider text NOT NULL DEFAULT 'razorpay',
  event_type text NOT NULL,
  provider_event_id text,
  amount integer,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_events_select_own ON public.billing_events;
CREATE POLICY billing_events_select_own
ON public.billing_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS billing_events_admin_all ON public.billing_events;
CREATE POLICY billing_events_admin_all
ON public.billing_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON public.billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_provider_event_id ON public.billing_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order_id ON public.subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment_id ON public.subscriptions(razorpay_payment_id);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan plan_tier NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_plan_id text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  interval text NOT NULL DEFAULT 'monthly',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_plans_select_active ON public.billing_plans;
CREATE POLICY billing_plans_select_active
ON public.billing_plans
FOR SELECT
TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS billing_plans_admin_all ON public.billing_plans;
CREATE POLICY billing_plans_admin_all
ON public.billing_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_billing_plans_provider_plan_id ON public.billing_plans(provider_plan_id);
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dodo_subscription_id text,
  ADD COLUMN IF NOT EXISTS dodo_payment_id text,
  ADD COLUMN IF NOT EXISTS dodo_customer_id text,
  ADD COLUMN IF NOT EXISTS dodo_checkout_session_id text;

CREATE INDEX IF NOT EXISTS subscriptions_dodo_subscription_id_idx
  ON public.subscriptions(dodo_subscription_id);

UPDATE public.billing_plans SET active = false WHERE provider = 'razorpay';
CREATE TABLE IF NOT EXISTS public.litigation_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cnr','keyword','competitor','regulator')),
  label TEXT NOT NULL,
  identifier TEXT NOT NULL,
  notes TEXT,
  last_checked_at TIMESTAMPTZ,
  last_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.litigation_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_select_own" ON public.litigation_watchlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "watchlist_insert_own" ON public.litigation_watchlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist_update_own" ON public.litigation_watchlist
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist_delete_own" ON public.litigation_watchlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER litigation_watchlist_set_updated_at
  BEFORE UPDATE ON public.litigation_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_litigation_watchlist_user_kind ON public.litigation_watchlist(user_id, kind);

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

-- contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  matter_id uuid REFERENCES public.matters(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploaded', -- uploaded | processing | ready | failed | needs_review
  error_message text,
  -- classification
  doc_type text,
  doc_type_confidence numeric NOT NULL DEFAULT 0,
  jurisdiction text,
  governing_law text,
  risk_level text, -- LOW | MEDIUM | HIGH
  risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- entities
  parties jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_date date,
  expiry_date date,
  renewal_window text,
  termination_clause text,
  -- ops
  extracted_text text NOT NULL DEFAULT '',
  char_count integer NOT NULL DEFAULT 0,
  parse_method text,
  model text,
  needs_human_review boolean NOT NULL DEFAULT false,
  human_label text,
  human_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_user ON public.contracts(user_id, created_at DESC);
CREATE INDEX idx_contracts_type ON public.contracts(doc_type);
CREATE INDEX idx_contracts_review ON public.contracts(needs_human_review) WHERE needs_human_review = true;
CREATE INDEX idx_contracts_expiry ON public.contracts(expiry_date) WHERE expiry_date IS NOT NULL;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contracts_select_own ON public.contracts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY contracts_insert_own ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY contracts_update_own ON public.contracts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY contracts_delete_own ON public.contracts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime
ALTER TABLE public.contracts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-intake', 'contract-intake', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "contract_intake_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "contract_intake_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "contract_intake_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "contract_intake_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS analysis jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'solo',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Members
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- Invites
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_invites_email ON public.organization_invites(lower(email));
CREATE INDEX idx_org_invites_org ON public.organization_invites(organization_id);

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _min public.org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org
      AND user_id = _user
      AND CASE _min
            WHEN 'member' THEN role IN ('owner','admin','member')
            WHEN 'admin'  THEN role IN ('owner','admin')
            WHEN 'owner'  THEN role = 'owner'
          END
  );
$$;

-- Enable RLS
ALTER TABLE public.organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites  ENABLE ROW LEVEL SECURITY;

-- organizations policies
CREATE POLICY orgs_select_member ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY orgs_insert_creator ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY orgs_update_admin ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(id, auth.uid(), 'admin'));
CREATE POLICY orgs_delete_owner ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), 'owner'));

-- organization_members policies
CREATE POLICY members_select_same_org ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY members_insert_admin ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY members_update_admin ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY members_delete_admin_or_self ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin') OR user_id = auth.uid());

-- organization_invites policies
CREATE POLICY invites_select_admin ON public.organization_invites FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY invites_insert_admin ON public.organization_invites FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin') AND invited_by = auth.uid());
CREATE POLICY invites_delete_admin ON public.organization_invites FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- Auto-add creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END $$;

CREATE TRIGGER on_org_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Accept-invite RPC: matches by email, validates expiry, joins user
CREATE OR REPLACE FUNCTION public.accept_organization_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.organization_invites%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_invite FROM public.organization_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_invite.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invite already accepted'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
  IF lower(v_invite.email) <> lower(v_email) THEN RAISE EXCEPTION 'This invite is for a different email'; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, auth.uid(), v_invite.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.organization_invites SET accepted_at = now() WHERE id = v_invite.id;
  RETURN v_invite.organization_id;
END $$;

-- 1. user_roles: prevent privilege escalation
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. usage_events: users insert only their own
CREATE POLICY "usage_events_insert_own" ON public.usage_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. organization_invites: invitee can see their own invite
CREATE POLICY "invites_select_invitee" ON public.organization_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())));

-- 4. Revoke execute on SECURITY DEFINER helpers from anon (and signed-in where internal-only)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.judgments_tsv_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) FROM anon;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_created ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can read
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role)
         OR public.has_role(auth.uid(), 'admin'::app_role));

-- No direct insert/update/delete from clients; only via the security-definer function below.

-- Secure logger
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _org uuid,
  _action text,
  _resource_type text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid := auth.uid();
  v_email text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;
  INSERT INTO public.audit_logs (organization_id, actor_user_id, actor_email, action, resource_type, resource_id, metadata)
  VALUES (_org, v_actor, v_email, _action, _resource_type, _resource_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) FROM anon;
-- authenticated can call (e.g., from the app for data-access events), still write-only

-- Trigger on members
CREATE OR REPLACE FUNCTION public.tg_audit_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'member.added', 'member', NEW.id::text,
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'member.role_changed', 'member', NEW.id::text,
      jsonb_build_object('user_id', NEW.user_id, 'from', OLD.role, 'to', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(OLD.organization_id, 'member.removed', 'member', OLD.id::text,
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_audit_members() FROM anon, authenticated, public;

CREATE TRIGGER trg_audit_members
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_members();

-- Trigger on invites
CREATE OR REPLACE FUNCTION public.tg_audit_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'invite.created', 'invite', NEW.id::text,
      jsonb_build_object('email', NEW.email, 'role', NEW.role));
  ELSIF TG_OP = 'UPDATE' AND OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'invite.accepted', 'invite', NEW.id::text,
      jsonb_build_object('email', NEW.email));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(OLD.organization_id, 'invite.revoked', 'invite', OLD.id::text,
      jsonb_build_object('email', OLD.email));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_audit_invites() FROM anon, authenticated, public;

CREATE TRIGGER trg_audit_invites
AFTER INSERT OR UPDATE OR DELETE ON public.organization_invites
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_invites();

CREATE TABLE public.organization_sso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_workspace','saml')),
  email_domain text NOT NULL,
  sso_provider_id text,
  default_role org_role NOT NULL DEFAULT 'member',
  role_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_org_sso_domain ON public.organization_sso (lower(email_domain)) WHERE is_active;

ALTER TABLE public.organization_sso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_sso_select_member" ON public.organization_sso
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "org_sso_write_admin" ON public.organization_sso
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_org_sso_updated_at
BEFORE UPDATE ON public.organization_sso
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Domain-to-org lookup callable from the sign-in page (no auth required)
CREATE OR REPLACE FUNCTION public.org_sso_for_domain(_domain text)
RETURNS TABLE (
  organization_id uuid, organization_name text, provider text,
  sso_provider_id text, email_domain text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id, o.name, s.provider, s.sso_provider_id, s.email_domain
  FROM public.organization_sso s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE lower(s.email_domain) = lower(_domain) AND s.is_active
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.org_sso_for_domain(text) TO anon, authenticated;

-- JIT provisioning: called from app after sign-in
CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_domain text;
  v_sso public.organization_sso%ROWTYPE;
  v_role org_role;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL OR position('@' in v_email) = 0 THEN RETURN NULL; END IF;
  v_domain := lower(split_part(v_email, '@', 2));

  SELECT * INTO v_sso FROM public.organization_sso
   WHERE lower(email_domain) = v_domain AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_role := v_sso.default_role;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_sso.organization_id, v_user, v_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  PERFORM public.log_audit_event(
    v_sso.organization_id, 'sso.jit_provisioned', 'member', v_user::text,
    jsonb_build_object('email', v_email, 'provider', v_sso.provider, 'role', v_role)
  );

  RETURN v_sso.organization_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.sso_jit_provision() FROM anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;

-- Ensure RLS is on (it normally is by default for realtime.messages)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any earlier permissive policy we may have created previously
DROP POLICY IF EXISTS "realtime_user_scoped_topics" ON realtime.messages;

-- Only allow reading messages for channel topics that end with the user's own id.
-- Frontend channels MUST be named like '<resource>:<auth.uid()>'.
CREATE POLICY "realtime_user_scoped_topics" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'postgres_changes'
    AND topic LIKE '%:' || auth.uid()::text
  );
-- 1) user_roles: prevent self-grant / self-modify
DROP POLICY IF EXISTS user_roles_admin_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_delete ON public.user_roles;

CREATE POLICY user_roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

CREATE POLICY user_roles_admin_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

CREATE POLICY user_roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- 2) SECURITY DEFINER functions: revoke broad EXECUTE; grant only what clients need
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant only the client-callable ones to authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_sso_for_domain(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) TO authenticated;
-- Enhance sso_jit_provision to honor per-org role_mappings from JWT app_metadata.
-- IdPs send groups via custom SAML attributes (e.g. "groups": ["legal-admins"])
-- which Supabase mirrors into raw_app_meta_data. We map the first matching group
-- â†’ org_role, falling back to organization_sso.default_role.

CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_domain text;
  v_sso public.organization_sso%ROWTYPE;
  v_role org_role;
  v_app_meta jsonb;
  v_groups jsonb;
  v_group text;
  v_mapped text;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;

  SELECT email, raw_app_meta_data
    INTO v_email, v_app_meta
    FROM auth.users WHERE id = v_user;
  IF v_email IS NULL OR position('@' in v_email) = 0 THEN RETURN NULL; END IF;
  v_domain := lower(split_part(v_email, '@', 2));

  SELECT * INTO v_sso FROM public.organization_sso
   WHERE lower(email_domain) = v_domain AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_role := v_sso.default_role;

  -- Role mapping: walk IdP-supplied groups, pick the highest-priority mapping.
  -- role_mappings shape: {"legal-admins":"admin","partners":"owner"}
  v_groups := COALESCE(v_app_meta->'groups', v_app_meta->'roles', '[]'::jsonb);
  IF jsonb_typeof(v_groups) = 'array' AND v_sso.role_mappings IS NOT NULL THEN
    FOR v_group IN SELECT jsonb_array_elements_text(v_groups) LOOP
      v_mapped := v_sso.role_mappings ->> v_group;
      IF v_mapped IN ('owner','admin','member') THEN
        -- pick most privileged across mapped groups
        IF v_mapped = 'owner' OR (v_mapped = 'admin' AND v_role <> 'owner') THEN
          v_role := v_mapped::org_role;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_sso.organization_id, v_user, v_role)
  ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = EXCLUDED.role
    WHERE public.organization_members.role <> 'owner';

  PERFORM public.log_audit_event(
    v_sso.organization_id, 'sso.jit_provisioned', 'member', v_user::text,
    jsonb_build_object('email', v_email, 'provider', v_sso.provider, 'role', v_role, 'groups', v_groups)
  );

  RETURN v_sso.organization_id;
END $function$;

-- Lock down: only authenticated users may call.
REVOKE ALL ON FUNCTION public.sso_jit_provision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;
-- ============================================================
-- New pricing model: Starter / Professional / Firm / Enterprise
-- Drop and recreate billing_plans cleanly, add credits system
-- ============================================================

-- 1. Extend plan_tier enum with new tiers (safe - IF NOT EXISTS)
DO $$ BEGIN
  ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'starter';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'professional';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'enterprise';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Drop and recreate billing_plans cleanly
DROP TABLE IF EXISTS public.billing_plans CASCADE;

CREATE TABLE public.billing_plans (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  price_inr     INTEGER NOT NULL DEFAULT 0,
  seats         INTEGER NOT NULL DEFAULT 1,
  credits_month INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.billing_plans (id, display_name, price_inr, seats, credits_month, sort_order, features) VALUES
  ('starter',      'Starter',      1999,  1,   100,  1, '["100 AI credits/month","Case-law research","Contract drafting","Matter management","Export PDF/DOCX","GST invoices","Email support"]'::jsonb),
  ('professional', 'Professional', 4999,  1,   500,  2, '["500 AI credits/month","Everything in Starter","Litigation Intel + eCourts","Audit log","Priority support","SSO ready"]'::jsonb),
  ('firm',         'Firm',         14999, 5,   2000, 3, '["2,000 pooled credits/month","Up to 5 seats","Everything in Professional","Shared matters","Dedicated onboarding","SLA support"]'::jsonb),
  ('enterprise',   'Enterprise',   0,     999, 0,    4, '["Unlimited seats","Unlimited credits","API access","Custom integrations","Dedicated account manager","On-premise option"]'::jsonb);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_plans_public_read ON public.billing_plans;
CREATE POLICY billing_plans_public_read ON public.billing_plans
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS billing_plans_admin_write ON public.billing_plans;
CREATE POLICY billing_plans_admin_write ON public.billing_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Add credits columns to subscriptions (safe)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credits_remaining  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seats_used         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dodo_customer_id   TEXT,
  ADD COLUMN IF NOT EXISTS dodo_payment_id    TEXT;

-- 4. Credit transactions log
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_tx_select_own ON public.credit_transactions;
CREATE POLICY credit_tx_select_own ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS credit_tx_insert_own ON public.credit_transactions;
CREATE POLICY credit_tx_insert_own ON public.credit_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);

-- 5. Credit costs per action
CREATE TABLE IF NOT EXISTS public.credit_costs (
  action      TEXT PRIMARY KEY,
  credits     INTEGER NOT NULL,
  description TEXT
);

INSERT INTO public.credit_costs (action, credits, description) VALUES
  ('research_query',    1, 'Case-law or web research query'),
  ('contract_analysis', 3, 'Contract intake & clause extraction'),
  ('litigation_brief',  2, 'Litigation intelligence brief'),
  ('draft_generation',  1, 'Contract/document draft generation'),
  ('decision_engine',   2, 'Legal decision engine query'),
  ('vision_ocr',        1, 'OCR page extraction')
ON CONFLICT (action) DO UPDATE SET credits = EXCLUDED.credits;

ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_costs_read ON public.credit_costs;
CREATE POLICY credit_costs_read ON public.credit_costs FOR SELECT TO authenticated USING (true);

-- 6. Atomic credit deduction function
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id UUID,
  _action  TEXT,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_cost     INTEGER;
  v_sub_id   UUID;
  v_balance  INTEGER;
  v_new_bal  INTEGER;
  v_plan     TEXT;
BEGIN
  SELECT credits INTO v_cost FROM public.credit_costs WHERE action = _action;
  IF v_cost IS NULL THEN v_cost := 1; END IF;

  SELECT id, credits_remaining, plan::text
    INTO v_sub_id, v_balance, v_plan
    FROM public.subscriptions
   WHERE user_id = _user_id AND status = 'active'
   LIMIT 1;

  IF v_plan = 'enterprise' THEN RETURN 9999; END IF;
  IF v_sub_id IS NULL THEN RETURN -1; END IF;
  IF v_balance < v_cost THEN RETURN -1; END IF;

  v_new_bal := v_balance - v_cost;

  UPDATE public.subscriptions
     SET credits_remaining = v_new_bal
   WHERE id = v_sub_id;

  INSERT INTO public.credit_transactions
    (user_id, subscription_id, amount, balance_after, reason, metadata)
  VALUES
    (_user_id, v_sub_id, -v_cost, v_new_bal, _action, _metadata);

  RETURN v_new_bal;
END;
$func$;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) TO authenticated, service_role;

-- 7. Monthly credit reset function
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_credits INTEGER;
  v_sub_id  UUID;
BEGIN
  SELECT s.id, bp.credits_month
    INTO v_sub_id, v_credits
    FROM public.subscriptions s
    JOIN public.billing_plans bp ON bp.id = s.plan::text
   WHERE s.user_id = _user_id
   LIMIT 1;

  IF v_sub_id IS NULL THEN RETURN; END IF;

  UPDATE public.subscriptions
     SET credits_remaining = v_credits,
         credits_reset_at  = now() + INTERVAL '1 month'
   WHERE id = v_sub_id;

  INSERT INTO public.credit_transactions
    (user_id, subscription_id, amount, balance_after, reason)
  VALUES
    (_user_id, v_sub_id, v_credits, v_credits, 'monthly_reset');
END;
$func$;

REVOKE ALL ON FUNCTION public.reset_monthly_credits(uuid) FROM PUBLIC, anon, authenticated;

-- 8. Update handle_new_user to default to starter
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, credits_remaining, credits_reset_at)
  VALUES (NEW.id, 'starter', 'active', 100, now() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;
-- Edge functions call RPCs with the service_role key; grant EXECUTE after the
-- 20260521040936 lockdown migration revoked broad function access.

GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits(uuid) TO service_role;

-- New signups: active trial with starter-plan credits (was incomplete + 0 â†’ all AI calls failed).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_trial_credits INTEGER;
BEGIN
  SELECT credits_month INTO v_trial_credits
    FROM public.billing_plans
   WHERE id = 'starter'
   LIMIT 1;

  IF v_trial_credits IS NULL OR v_trial_credits < 1 THEN
    v_trial_credits := 25;
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (
    user_id, plan, status, credits_remaining, credits_reset_at
  )
  VALUES (
    NEW.id,
    'starter',
    'active',
    v_trial_credits,
    now() + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;

-- Existing accounts stuck on incomplete / zero credits (dev + early users).
UPDATE public.subscriptions s
   SET status = 'active',
       credits_remaining = GREATEST(
         s.credits_remaining,
         COALESCE((SELECT bp.credits_month FROM public.billing_plans bp WHERE bp.id = 'starter'), 25)
       ),
       credits_reset_at = COALESCE(s.credits_reset_at, now() + INTERVAL '30 days')
 WHERE s.credits_remaining = 0;
-- Security hardening: subscription self-upgrade, credit ledger, SSO domain probe

-- 1. Users must not UPDATE their own subscription (plan/status/credits) from the client.
DROP POLICY IF EXISTS "subs_update_own" ON public.subscriptions;

-- 2. Credit ledger rows only via SECURITY DEFINER RPCs (service_role / deduct_credits).
DROP POLICY IF EXISTS credit_tx_insert_own ON public.credit_transactions;

-- 3. SSO org lookup: authenticated only (no anonymous domain enumeration).
REVOKE ALL ON FUNCTION public.org_sso_for_domain(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_sso_for_domain(text) TO authenticated;

-- 4. SSO JIT: only for verified SSO/OAuth sign-ins, not password email signup.
DROP FUNCTION IF EXISTS public.sso_jit_provision();
CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_domain TEXT;
  v_org    RECORD;
  v_amr    TEXT;
  v_provider TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN RETURN; END IF;

  v_amr := COALESCE(auth.jwt() ->> 'amr', '');
  v_provider := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'provider',
    auth.jwt() -> 'user_metadata' ->> 'provider',
    ''
  );

  -- Skip password / magic-link sign-ins (domain-only join is unsafe).
  IF v_amr ILIKE '%password%' OR v_amr ILIKE '%otp%' OR v_amr ILIKE '%email%' THEN
    RETURN;
  END IF;
  IF v_provider IN ('email', '') AND v_amr NOT ILIKE '%sso%' AND v_amr NOT ILIKE '%oauth%' THEN
    RETURN;
  END IF;

  v_domain := lower(split_part(v_email, '@', 2));

  SELECT o.id, o.name, s.default_role, s.role_mappings
    INTO v_org
    FROM public.organization_sso s
    JOIN public.organizations o ON o.id = s.organization_id
   WHERE lower(s.email_domain) = v_domain
     AND s.is_enabled = true
   LIMIT 1;

  IF v_org.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, v_uid, COALESCE(v_org.default_role, 'member'))
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$func$;
-- Microsoft 365 production: server-side tokens, activity logs, safe client view

-- Revoke client writes of OAuth secrets (edge functions use service_role)
DROP POLICY IF EXISTS "m365_insert_own" ON public.m365_connections;
DROP POLICY IF EXISTS "m365_update_own" ON public.m365_connections;

-- Feature toggles on connection row (before view)
ALTER TABLE public.m365_connections
  ADD COLUMN IF NOT EXISTS teams_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sharepoint_enabled BOOLEAN NOT NULL DEFAULT true;

-- Safe status view (no access_token / refresh_token exposed to clients)
DROP VIEW IF EXISTS public.m365_connection_status;
CREATE VIEW public.m365_connection_status
WITH (security_invoker = true) AS
SELECT
  user_id,
  ms_user_id,
  ms_email,
  ms_name,
  scopes,
  onedrive_enabled,
  calendar_enabled,
  teams_enabled,
  sharepoint_enabled,
  connected_at,
  last_used_at,
  token_expires_at,
  (token_expires_at IS NULL OR token_expires_at > now()) AS token_valid
FROM public.m365_connections;

GRANT SELECT ON public.m365_connection_status TO authenticated;

-- Teams message log
CREATE TABLE IF NOT EXISTS public.teams_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id      TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  message_id   TEXT,
  web_url      TEXT,
  preview      TEXT,
  matter_id    UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teams_posts_select_own ON public.teams_posts;
CREATE POLICY teams_posts_select_own ON public.teams_posts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_teams_posts_user ON public.teams_posts(user_id, created_at DESC);

-- SharePoint upload log
CREATE TABLE IF NOT EXISTS public.sharepoint_exports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id      TEXT NOT NULL,
  drive_id     TEXT,
  item_id      TEXT,
  web_url      TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  matter_id    UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  draft_id     UUID REFERENCES public.drafts(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sharepoint_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sharepoint_exports_select_own ON public.sharepoint_exports;
CREATE POLICY sharepoint_exports_select_own ON public.sharepoint_exports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sharepoint_exports_user ON public.sharepoint_exports(user_id, created_at DESC);
-- Critical security lockdown: RPC grants, subscriptions, M365 tokens, SSO JIT fix

-- 1. Credit RPC: edge functions only (service_role)
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) TO service_role;

-- 2. Judgment search: edge functions only
REVOKE EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) TO service_role;

-- 3. Subscriptions: no client INSERT (prevents self-grant active/enterprise)
DROP POLICY IF EXISTS "subs_insert_own" ON public.subscriptions;

-- 4. M365: clients must not read OAuth secrets from base table
DROP POLICY IF EXISTS "m365_select_own" ON public.m365_connections;
DROP POLICY IF EXISTS "m365_admin_select" ON public.m365_connections;

-- 5. Org SSO config: admins read-only (writes via edge function / service_role)
DROP POLICY IF EXISTS "org_sso_write_admin" ON public.organization_sso;
CREATE POLICY "org_sso_admin_select" ON public.organization_sso
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_org_role(auth.uid(), organization_id, 'admin'));

-- 6. SSO JIT: fix column name is_active (was is_enabled in broken migration)
DROP FUNCTION IF EXISTS public.sso_jit_provision();
CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_domain TEXT;
  v_org    RECORD;
  v_amr    TEXT;
  v_provider TEXT;
  v_role   org_role;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN RETURN; END IF;

  v_amr := COALESCE(auth.jwt() ->> 'amr', '');
  v_provider := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'provider',
    auth.jwt() -> 'user_metadata' ->> 'provider',
    ''
  );

  IF v_amr ILIKE '%password%' OR v_amr ILIKE '%otp%' OR v_amr ILIKE '%email%' THEN
    RETURN;
  END IF;
  IF v_provider IN ('email', '') AND v_amr NOT ILIKE '%sso%' AND v_amr NOT ILIKE '%oauth%' THEN
    RETURN;
  END IF;

  v_domain := lower(split_part(v_email, '@', 2));

  SELECT o.id, o.name, s.default_role
    INTO v_org
    FROM public.organization_sso s
    JOIN public.organizations o ON o.id = s.organization_id
   WHERE lower(s.email_domain) = v_domain
     AND s.is_active = true
   LIMIT 1;

  IF v_org.id IS NULL THEN RETURN; END IF;

  v_role := COALESCE(v_org.default_role, 'member'::org_role);
  IF v_role = 'admin'::org_role THEN
    v_role := 'member'::org_role;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, v_uid, v_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$func$;

REVOKE ALL ON FUNCTION public.sso_jit_provision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to reset credits
CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET credits_remaining = monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the function to run at 00:00 on the 1st of every month
SELECT cron.schedule(
  'monthly_credit_reset',
  '0 0 1 * *',
  'SELECT public.reset_monthly_credits();'
);
-- Set up subscriptions table based on Dodo Payments
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  provider_id text NOT NULL UNIQUE,
  plan text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND indexname = 'subscriptions_provider_id_idx'
  ) THEN
    CREATE UNIQUE INDEX subscriptions_provider_id_idx ON public.subscriptions(provider_id);
  END IF;
END;
$$;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION handle_subscription_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.profiles SET role = 'pro' WHERE id = NEW.user_id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.profiles SET role = 'free' WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid errors on reruns
DROP TRIGGER IF EXISTS on_subscription_update ON public.subscriptions;
CREATE TRIGGER on_subscription_update
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_subscription_update();
-- Fix sso_jit_provision to return whether a new membership was actually created
-- to prevent repetitive "Welcome" toasts on every sign-in/refresh.

DROP FUNCTION IF EXISTS public.sso_jit_provision();

CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_domain TEXT;
  v_org    RECORD;
  v_amr    TEXT;
  v_provider TEXT;
  v_role   org_role;
  v_rows   INT;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN RETURN false; END IF;

  v_amr := COALESCE(auth.jwt() ->> 'amr', '');
  v_provider := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'provider',
    auth.jwt() -> 'user_metadata' ->> 'provider',
    ''
  );

  IF v_amr ILIKE '%password%' OR v_amr ILIKE '%otp%' OR v_amr ILIKE '%email%' THEN
    RETURN false;
  END IF;
  IF v_provider IN ('email', '') AND v_amr NOT ILIKE '%sso%' AND v_amr NOT ILIKE '%oauth%' THEN
    RETURN false;
  END IF;

  v_domain := lower(split_part(v_email, '@', 2));

  SELECT o.id, o.name, s.default_role
    INTO v_org
    FROM public.organization_sso s
    JOIN public.organizations o ON o.id = s.organization_id
   WHERE lower(s.email_domain) = v_domain
     AND s.is_active = true
   LIMIT 1;

  IF v_org.id IS NULL THEN RETURN false; END IF;

  v_role := COALESCE(v_org.default_role, 'member'::org_role);
  IF v_role = 'admin'::org_role THEN
    v_role := 'member'::org_role;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, v_uid, v_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$func$;

REVOKE ALL ON FUNCTION public.sso_jit_provision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;
-- Every new signup must have 10 credits so they can explore the platform.
-- This updates the handle_new_user trigger to grant exactly 10 credits initially.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_initial_credits INTEGER := 10;
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- 2. Grant default App Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  -- 3. Provision trial subscription with 10 exploration credits
  -- We use 'starter' plan as the base for the trial.
  INSERT INTO public.subscriptions (
    user_id, 
    plan, 
    status, 
    credits_remaining, 
    credits_reset_at
  )
  VALUES (
    NEW.id,
    'starter',
    'active',
    v_initial_credits,
    now() + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;
-- Update billing_plans to include a 'trial' plan with 0 monthly credits.
-- This ensures that users on the trial plan don't get recurring free credits.

INSERT INTO public.billing_plans (id, display_name, price_inr, seats, credits_month, sort_order, is_active, features)
VALUES (
  'trial', 
  'Free Trial', 
  0, 
  1, 
  0, 
  0, 
  false, 
  '["10 one-time signup credits","Limited access"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
  credits_month = EXCLUDED.credits_month,
  is_active = EXCLUDED.is_active;

-- Update handle_new_user to use the 'trial' plan and grant 10 one-time credits.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- 2. Grant default App Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  -- 3. Provision ONE-TIME trial credits
  -- We set plan to 'trial' which has 0 credits_month, so resets won't add more.
  -- credits_reset_at is set to a far future date to prevent accidental resets 
  -- by the monthly cron, or we can set it to NULL if the reset logic handles it.
  INSERT INTO public.subscriptions (
    user_id, 
    plan, 
    status, 
    credits_remaining, 
    credits_reset_at
  )
  VALUES (
    NEW.id,
    'trial',
    'active',
    10,
    NULL
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;

-- Update the monthly reset logic to EXCLUDE 'trial' plan users or users with NULL reset_at.
-- This ensures their one-time bonus doesn't get wiped or topped up.
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_credits INTEGER;
  v_sub_id  UUID;
  v_plan    TEXT;
BEGIN
  SELECT s.id, bp.credits_month, s.plan::text
    INTO v_sub_id, v_credits, v_plan
    FROM public.subscriptions s
    JOIN public.billing_plans bp ON bp.id = s.plan::text
   WHERE s.user_id = _user_id
   LIMIT 1;

  IF v_sub_id IS NULL OR v_plan = 'trial' THEN RETURN; END IF;

  UPDATE public.subscriptions
     SET credits_remaining = v_credits,
         credits_reset_at  = now() + INTERVAL '1 month'
   WHERE id = v_sub_id;

  INSERT INTO public.credit_transactions
    (user_id, subscription_id, amount, balance_after, reason)
  VALUES
    (_user_id, v_sub_id, v_credits, v_credits, 'monthly_reset');
END;
$func$;
-- Queue/Worker Pattern Support
-- This migration adds the necessary triggers to support async processing
-- of contracts and litigation watchlist items.

-- 1. Contract Processing Webhook
-- When a contract status is set to 'queued', trigger the edge function.
CREATE OR REPLACE FUNCTION public.trigger_contract_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'queued' AND (OLD.status IS NULL OR OLD.status != 'queued') THEN
    -- In a real Supabase environment, you'd use pg_net to call the edge function:
    -- SELECT net.http_post(
    --   url := 'https://<ref>.functions.supabase.co/contract-intake',
    --   headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    --   body := jsonb_build_object('contractId', NEW.id, 'async', false)
    -- );
    NULL; -- Placeholder for architectural documentation
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Audit Trail for Async Jobs
CREATE TABLE IF NOT EXISTS public.async_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  resource_id  UUID NOT NULL,
  resource_type TEXT NOT NULL, -- 'contract' | 'litigation'
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  error        TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.async_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own jobs" ON public.async_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Utility to enqueue a job
CREATE OR REPLACE FUNCTION public.enqueue_job(
  _resource_id UUID,
  _type TEXT,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO public.async_jobs (user_id, resource_id, resource_type, metadata)
  VALUES (auth.uid(), _resource_id, _type, _metadata)
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;
-- Granular RBAC for Enterprise Law Firms
-- This migration extends the user_roles to support more specific firm hierarchies.

-- 1. Extend app_role enum (safe)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'associate';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'billing_admin';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Enhanced has_role check that supports hierarchy
CREATE OR REPLACE FUNCTION public.has_role_v2(_user_id UUID, _required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role::text INTO v_user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  -- Super-admin always wins
  IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
  
  -- Hierarchy: admin > partner > lawyer > associate
  IF _required_role = 'lawyer' AND v_user_role IN ('admin', 'partner', 'lawyer') THEN RETURN TRUE; END IF;
  IF _required_role = 'associate' AND v_user_role IN ('admin', 'partner', 'lawyer', 'associate') THEN RETURN TRUE; END IF;
  
  RETURN v_user_role = _required_role;
END;
$$;

-- 3. Org-level Permissions (Member Roles are already Granular: owner, admin, member)
-- We add a more specific permission check function.
CREATE OR REPLACE FUNCTION public.check_org_permission(_user_id UUID, _org_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role org_role;
BEGIN
  SELECT role INTO v_role 
    FROM public.organization_members 
   WHERE user_id = _user_id AND organization_id = _org_id 
   LIMIT 1;

  IF v_role = 'owner' THEN RETURN TRUE; END IF;
  
  IF _permission = 'invite_user' AND v_role IN ('owner', 'admin') THEN RETURN TRUE; END IF;
  IF _permission = 'billing_manage' AND v_role IN ('owner', 'admin') THEN RETURN TRUE; END IF;
  IF _permission = 'data_view' AND v_role IS NOT NULL THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;
-- Enterprise Asynchronous Document Processing Pipeline
-- Migration: 20260602000005_enterprise_async_pipeline.sql

-- 1. Enums for Job tracking
DO $$ BEGIN
    CREATE TYPE public.job_status AS ENUM ('queued', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.job_stage AS ENUM ('ingestion', 'extraction', 'chunking', 'analysis', 'aggregation', 'storage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Processing Jobs Table
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    resource_id UUID NOT NULL,
    resource_type TEXT NOT NULL, -- e.g., 'contract_intake', 'litigation_intel'
    status public.job_status NOT NULL DEFAULT 'queued',
    stage public.job_stage NOT NULL DEFAULT 'ingestion',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    result JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 3. RLS Policies
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
    ON public.processing_jobs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. Enable Realtime
-- This adds the table to the supabase_realtime publication.
-- Note: In some Supabase versions, you need to manage the publication carefully.
ALTER TABLE public.processing_jobs REPLICA IDENTITY FULL;

-- 5. Trigger for updated_at
-- Assuming public.handle_updated_at() already exists from previous migrations.
CREATE TRIGGER set_processing_jobs_updated_at
    BEFORE UPDATE ON public.processing_jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Grant access to service_role (for Edge Functions)
GRANT ALL ON public.processing_jobs TO service_role;
GRANT ALL ON public.processing_jobs TO authenticated;

-- 7. Add index for faster lookups
CREATE INDEX idx_processing_jobs_user_status ON public.processing_jobs(user_id, status);
CREATE INDEX idx_processing_jobs_resource ON public.processing_jobs(resource_id, resource_type);
-- Upgrade search_judgments to use Reciprocal Rank Fusion (RRF) 
-- and support metadata filtering for enterprise-grade research.

CREATE OR REPLACE FUNCTION public.search_judgments_v2(
  query_text TEXT,
  query_embedding extensions.vector(1536),
  match_count INT DEFAULT 10,
  filter_court TEXT DEFAULT NULL,
  filter_year_start INT DEFAULT NULL,
  filter_year_end INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  citation TEXT,
  neutral_citation TEXT,
  court TEXT,
  bench TEXT,
  judges TEXT[],
  decision_date DATE,
  headnote TEXT,
  summary TEXT,
  similarity FLOAT,
  rrf_score FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN QUERY
  WITH normalized AS (
    SELECT
      trim(query_text) AS q,
      websearch_to_tsquery('english', trim(query_text)) AS webq,
      plainto_tsquery('english', trim(query_text)) AS plainq
  ),
  semantic AS (
    SELECT j.id, 
           1 - (j.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity,
           row_number() OVER (ORDER BY j.embedding OPERATOR(extensions.<=>) query_embedding) as rank
    FROM public.judgments j
    WHERE j.embedding IS NOT NULL
      AND extensions.vector_norm(query_embedding) > 0
      AND (filter_court IS NULL OR j.court = filter_court)
      AND (filter_year_start IS NULL OR extract(year from j.decision_date) >= filter_year_start)
      AND (filter_year_end IS NULL OR extract(year from j.decision_date) <= filter_year_end)
    LIMIT match_count * 5
  ),
  keyword AS (
    SELECT j.id,
           ts_rank_cd(j.tsv, n.webq) as rank_score,
           row_number() OVER (ORDER BY ts_rank_cd(j.tsv, n.webq) DESC) as rank
    FROM public.judgments j, normalized n
    WHERE (j.tsv @@ n.webq OR j.tsv @@ n.plainq)
      AND (filter_court IS NULL OR j.court = filter_court)
      AND (filter_year_start IS NULL OR extract(year from j.decision_date) >= filter_year_start)
      AND (filter_year_end IS NULL OR extract(year from j.decision_date) <= filter_year_end)
    ORDER BY rank_score DESC
    LIMIT match_count * 5
  ),
  rrf AS (
    -- Reciprocal Rank Fusion (k=60 is standard)
    SELECT 
      COALESCE(s.id, k.id) as id,
      COALESCE(1.0 / (60 + s.rank), 0.0) + COALESCE(1.0 / (60 + k.rank), 0.0) as rrf_score,
      s.similarity
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.id = k.id
  )
  SELECT j.id, j.title, j.citation, j.neutral_citation, j.court, j.bench,
         j.judges, j.decision_date, j.headnote, j.summary,
         r.similarity, r.rrf_score
  FROM rrf r
  JOIN public.judgments j ON j.id = r.id
  ORDER BY r.rrf_score DESC
  LIMIT match_count;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.search_judgments_v2 TO service_role;
GRANT EXECUTE ON FUNCTION public.search_judgments_v2 TO authenticated;
-- Add conversation column to drafts table to enable persistent multi-turn history.

ALTER TABLE public.drafts 
ADD COLUMN IF NOT EXISTS conversation JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Update RLS if needed (already broad enough usually)
-- GRANT ALL ON public.drafts TO authenticated;
-- Enterprise Manual Billing Infrastructure
-- This migration adds support for non-automated, manually invoiced subscriptions.

-- 1. Ensure provider_id exists and relax provider_id constraint for manual enterprise accounts
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_id text;
ALTER TABLE public.subscriptions ALTER COLUMN IF EXISTS provider_id DROP NOT NULL;

-- 2. Add billing metadata to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS is_manual_billing BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ;

-- 3. Enterprise Invoices Table
CREATE TABLE IF NOT EXISTS public.enterprise_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount_inr INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, overdue, void
    due_date DATE,
    paid_at TIMESTAMPTZ,
    invoice_number TEXT UNIQUE,
    pdf_url TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enterprise invoices"
    ON public.enterprise_invoices FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. Function to manually provision Enterprise
CREATE OR REPLACE FUNCTION public.provision_enterprise_plan(
    _user_id UUID,
    _duration_months INTEGER DEFAULT 12
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub_id UUID;
BEGIN
    -- Check if admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Only admins can manually provision Enterprise plans';
    END IF;

    -- Upsert subscription
    INSERT INTO public.subscriptions (
        user_id,
        plan,
        status,
        credits_remaining,
        is_manual_billing,
        current_period_end
    )
    VALUES (
        _user_id,
        'enterprise',
        'active',
        999999,
        true,
        now() + (_duration_months || ' months')::interval
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        credits_remaining = EXCLUDED.credits_remaining,
        is_manual_billing = true,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now()
    RETURNING id INTO v_sub_id;

    RETURN v_sub_id;
END;
$$;
-- Weybre AI Phase 2: Category-Defining Legal OS
-- Migration: 20260602000009_phase2_core_schemas.sql

-- ============================================================
-- INITIATIVE 1: Knowledge Graph & Citation Moat
-- ============================================================

-- Citation Sentiment Enum
DO $$ BEGIN
    CREATE TYPE public.citation_sentiment AS ENUM ('relies_on', 'distinguishes', 'overrules', 'referred_to', 'dissents_from');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Citation Graph Table (Edges)
CREATE TABLE IF NOT EXISTS public.judgment_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_judgment_id UUID NOT NULL REFERENCES public.judgments(id) ON DELETE CASCADE,
    target_judgment_id UUID NOT NULL REFERENCES public.judgments(id) ON DELETE CASCADE,
    sentiment public.citation_sentiment NOT NULL DEFAULT 'referred_to',
    extracted_context TEXT, -- The paragraph containing the citation
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_judgment_id, target_judgment_id)
);

-- Index for citation chain traversal
CREATE INDEX idx_citations_source ON public.judgment_citations(source_judgment_id);
CREATE INDEX idx_citations_target ON public.judgment_citations(target_judgment_id);

-- ============================================================
-- INITIATIVE 2: Multi-Turn Iterative Drafting (Version Control)
-- ============================================================

-- Draft Versions (Immutable snapshots)
CREATE TABLE IF NOT EXISTS public.draft_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    change_summary TEXT, -- e.g., "Refined Section 7 per user request"
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_draft_versions_parent ON public.draft_versions(draft_id, created_at DESC);

-- Firm Clause Library
CREATE TABLE IF NOT EXISTS public.clause_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    clause_text TEXT NOT NULL,
    category TEXT, -- e.g., 'Indemnity', 'Liability'
    tags TEXT[],
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INITIATIVE 6: Advanced Litigation Analytics
-- ============================================================

-- Judge Intelligence
CREATE TABLE IF NOT EXISTS public.judge_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judge_name TEXT NOT NULL,
    court TEXT NOT NULL,
    disposal_rate FLOAT, -- cases/year
    avg_duration_days INTEGER,
    grant_rate_bail FLOAT,
    grant_rate_injunction FLOAT,
    common_citations TEXT[], -- Frequently cited precedents
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (judge_name, court)
);

-- Advocate/Lawyer Intelligence
CREATE TABLE IF NOT EXISTS public.advocate_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advocate_name TEXT NOT NULL,
    bar_enrollment_no TEXT UNIQUE,
    practice_areas TEXT[],
    win_rate FLOAT,
    court_frequency JSONB, -- { "Supreme Court": 0.4, "Delhi HC": 0.6 }
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INITIATIVE 5: Developer Platform
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- e.g., 'wyb_...'
    name TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{research:read}',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL, -- e.g., '{job.completed, invoice.paid}'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS & Permissions
-- ============================================================

ALTER TABLE public.judgment_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocate_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Judgments public view" ON public.judgment_citations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Draft versions own view" ON public.draft_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Clause library org view" ON public.clause_library FOR SELECT TO authenticated 
    USING (organization_id IS NULL OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

GRANT ALL ON public.judgment_citations TO service_role;
GRANT ALL ON public.draft_versions TO service_role;
GRANT ALL ON public.clause_library TO service_role;
GRANT ALL ON public.judge_stats TO service_role;
GRANT ALL ON public.advocate_stats TO service_role;
GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON public.webhook_endpoints TO service_role;
-- Knowledge Graph Traversal Functions for GraphRAG
-- Migration: 20260602000010_graph_traversal.sql

-- Find the "Influence" of a judgment (outbound citations)
CREATE OR REPLACE FUNCTION public.get_judgment_outbound_citations(_judgment_id UUID)
RETURNS TABLE (
    citation_id UUID,
    target_id UUID,
    title TEXT,
    citation TEXT,
    sentiment public.citation_sentiment,
    context TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT 
        c.id as citation_id,
        j.id as target_id,
        j.title,
        j.neutral_citation,
        c.sentiment,
        c.extracted_context
    FROM public.judgment_citations c
    JOIN public.judgments j ON j.id = c.target_judgment_id
    WHERE c.source_judgment_id = _judgment_id;
$$;

-- Find the "Precedents" of a judgment (inbound citations - who cited this?)
CREATE OR REPLACE FUNCTION public.get_judgment_inbound_citations(_judgment_id UUID)
RETURNS TABLE (
    citation_id UUID,
    source_id UUID,
    title TEXT,
    citation TEXT,
    sentiment public.citation_sentiment,
    context TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT 
        c.id as citation_id,
        j.id as source_id,
        j.title,
        j.neutral_citation,
        c.sentiment,
        c.extracted_context
    FROM public.judgment_citations c
    JOIN public.judgments j ON j.id = c.source_judgment_id
    WHERE c.target_judgment_id = _judgment_id;
$$;

-- Recursive Citation Chain Traversal (Enterprise Grade)
-- Finds the lineage of a case up to N levels deep
CREATE OR REPLACE FUNCTION public.get_citation_lineage(_judgment_id UUID, _depth INT DEFAULT 2)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH RECURSIVE lineage AS (
        -- Anchor member
        SELECT 
            target_judgment_id as id,
            source_judgment_id as parent_id,
            sentiment,
            1 as depth
        FROM public.judgment_citations
        WHERE target_judgment_id = _judgment_id
        
        UNION ALL
        
        -- Recursive member
        SELECT 
            c.target_judgment_id,
            c.source_judgment_id,
            c.sentiment,
            l.depth + 1
        FROM public.judgment_citations c
        INNER JOIN lineage l ON c.target_judgment_id = l.parent_id
        WHERE l.depth < _depth
    )
    SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'parent_id', l.parent_id,
        'sentiment', l.sentiment,
        'depth', l.depth,
        'title', j.title,
        'citation', j.neutral_citation
    )) INTO v_result
    FROM lineage l
    JOIN public.judgments j ON j.id = l.id;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_citation_lineage TO service_role;
GRANT EXECUTE ON FUNCTION public.get_citation_lineage TO authenticated;
-- Enterprise Legal RAG: Granular Chunking & Hybrid Search
-- Migration: 20260602000011_enterprise_legal_rag.sql

-- 1. Judgment Chunks Table
CREATE TABLE IF NOT EXISTS public.judgment_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judgment_id UUID NOT NULL REFERENCES public.judgments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL DEFAULT 'general', -- 'fact', 'issue', 'holding', 'precedent_ref'
    sequence_order INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding extensions.vector(1536),
    tsv extensions.tsvector,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for Performance
CREATE INDEX idx_judgment_chunks_judgment_id ON public.judgment_chunks(judgment_id);
CREATE INDEX idx_judgment_chunks_tsv ON public.judgment_chunks USING GIN (tsv);
CREATE INDEX idx_judgment_chunks_embedding ON public.judgment_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- 3. Automatic TSVector Trigger for Chunks
CREATE OR REPLACE FUNCTION public.judgment_chunks_tsv_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.tsv := to_tsvector('english', NEW.content);
  RETURN NEW;
END $$;

CREATE TRIGGER judgment_chunks_tsv_update
BEFORE INSERT OR UPDATE ON public.judgment_chunks
FOR EACH ROW EXECUTE FUNCTION public.judgment_chunks_tsv_trigger();

-- 4. Hybrid Search with RRF (Reciprocal Rank Fusion)
-- Merges Vector and Keyword search at the chunk level.
CREATE OR REPLACE FUNCTION public.hybrid_legal_search(
    query_text TEXT,
    query_embedding extensions.vector(1536),
    match_count INT DEFAULT 10,
    filter_court TEXT DEFAULT NULL,
    filter_year_start INT DEFAULT NULL,
    filter_year_end INT DEFAULT NULL
)
RETURNS TABLE (
    chunk_id UUID,
    judgment_id UUID,
    content TEXT,
    chunk_type TEXT,
    case_title TEXT,
    court TEXT,
    decision_date DATE,
    neutral_citation TEXT,
    similarity FLOAT,
    rrf_score FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN QUERY
  WITH semantic AS (
    SELECT c.id, 
           1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity,
           row_number() OVER (ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding) as rank
    FROM public.judgment_chunks c
    JOIN public.judgments j ON j.id = c.judgment_id
    WHERE c.embedding IS NOT NULL
      AND (filter_court IS NULL OR j.court = filter_court)
      AND (filter_year_start IS NULL OR extract(year from j.decision_date) >= filter_year_start)
      AND (filter_year_end IS NULL OR extract(year from j.decision_date) <= filter_year_end)
    LIMIT match_count * 10
  ),
  keyword AS (
    SELECT c.id,
           ts_rank_cd(c.tsv, plainto_tsquery('english', query_text)) as rank_score,
           row_number() OVER (ORDER BY ts_rank_cd(c.tsv, plainto_tsquery('english', query_text)) DESC) as rank
    FROM public.judgment_chunks c
    JOIN public.judgments j ON j.id = c.judgment_id
    WHERE c.tsv @@ plainto_tsquery('english', query_text)
      AND (filter_court IS NULL OR j.court = filter_court)
      AND (filter_year_start IS NULL OR extract(year from j.decision_date) >= filter_year_start)
      AND (filter_year_end IS NULL OR extract(year from j.decision_date) <= filter_year_end)
    LIMIT match_count * 10
  ),
  rrf AS (
    SELECT 
      COALESCE(s.id, k.id) as id,
      COALESCE(1.0 / (60 + s.rank), 0.0) + COALESCE(1.0 / (60 + k.rank), 0.0) as rrf_score,
      s.similarity
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.id = k.id
  )
  SELECT c.id as chunk_id, j.id as judgment_id, c.content, c.chunk_type,
         j.title as case_title, j.court, j.decision_date, j.neutral_citation,
         r.similarity, r.rrf_score
  FROM rrf r
  JOIN public.judgment_chunks c ON c.id = r.id
  JOIN public.judgments j ON j.id = c.judgment_id
  ORDER BY r.rrf_score DESC
  LIMIT match_count;
END;
$$;

-- 5. RLS and Grants
ALTER TABLE public.judgment_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public chunks view" ON public.judgment_chunks FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.judgment_chunks TO service_role;
GRANT EXECUTE ON FUNCTION public.hybrid_legal_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.hybrid_legal_search TO service_role;
-- System-wide Legal Analytics
-- Migration: 20260602000012_system_legal_stats.sql

CREATE OR REPLACE FUNCTION public.get_system_legal_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_judgments INTEGER;
    v_avg_disposal_rate FLOAT;
    v_avg_wait_days INTEGER;
    v_total_judges INTEGER;
BEGIN
    SELECT count(*) INTO v_total_judgments FROM public.judgments;
    SELECT avg(disposal_rate) INTO v_avg_disposal_rate FROM public.judge_stats;
    SELECT avg(avg_duration_days) INTO v_avg_wait_days FROM public.judge_stats;
    SELECT count(*) INTO v_total_judges FROM public.judge_stats;

    RETURN jsonb_build_object(
        'total_judgments', v_total_judgments,
        'avg_disposal_rate', COALESCE(v_avg_disposal_rate, 0),
        'avg_wait_days', COALESCE(v_avg_wait_days, 0),
        'total_judges', v_total_judges
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_legal_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_legal_stats TO service_role;
-- Activate pg_net for outbound HTTP calls from Postgres triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Robust Queue/Worker Trigger using pg_net
-- Migration: 20260602000013_active_async_trigger.sql

CREATE OR REPLACE FUNCTION public.trigger_worker_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT;
    v_anon_key TEXT;
BEGIN
    -- Only trigger on new queued jobs
    IF NEW.status = 'queued' THEN
        -- Construct function URL (internal Supabase URL often works, but we use the configured one)
        v_url := (SELECT value FROM extensions.settings WHERE name = 'app.settings.supabase_url') || '/functions/v1/document-worker';
        v_anon_key := (SELECT value FROM extensions.settings WHERE name = 'app.settings.service_role_key');

        PERFORM net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object('jobId', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Drop old placeholder trigger if it exists
DROP TRIGGER IF EXISTS on_job_queued ON public.processing_jobs;

-- Apply to processing_jobs table
CREATE TRIGGER on_job_queued
AFTER INSERT ON public.processing_jobs
FOR EACH ROW EXECUTE FUNCTION public.trigger_worker_v2();
-- Add billing metadata fields to profiles
-- Migration: 20260602000014_profile_billing_fields.sql

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_zip TEXT,
ADD COLUMN IF NOT EXISTS gstin TEXT;

-- Update RLS (already enabled)
-- RAG Query Cache for performance
-- Migration: 20260602000015_rag_cache.sql

CREATE TABLE IF NOT EXISTS public.rag_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash TEXT NOT NULL UNIQUE,
    answer TEXT NOT NULL,
    sources JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);

-- Index for expiration cleanup
CREATE INDEX idx_rag_cache_expires ON public.rag_cache(expires_at);

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_rag_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rag_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Scale Vector Search with HNSW
-- Migration: 20260602000016_hnsw_indexes.sql

-- Drop old IVFFlat indexes
DROP INDEX IF EXISTS idx_judgment_chunks_embedding;
DROP INDEX IF EXISTS judgments_embedding_idx;

-- Create HNSW indexes (Better for 1M+ rows)
CREATE INDEX idx_judgment_chunks_embedding_hnsw 
ON public.judgment_chunks
USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX idx_judgments_embedding_hnsw
ON public.judgments
USING hnsw (embedding extensions.vector_cosine_ops);
