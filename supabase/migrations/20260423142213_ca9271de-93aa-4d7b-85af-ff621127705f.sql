
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

-- judgments — readable by all authenticated users
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
