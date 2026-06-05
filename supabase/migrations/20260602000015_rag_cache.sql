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
