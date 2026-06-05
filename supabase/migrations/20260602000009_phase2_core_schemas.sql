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
