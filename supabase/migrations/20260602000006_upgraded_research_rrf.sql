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
