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
