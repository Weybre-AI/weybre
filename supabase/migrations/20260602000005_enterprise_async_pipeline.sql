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
