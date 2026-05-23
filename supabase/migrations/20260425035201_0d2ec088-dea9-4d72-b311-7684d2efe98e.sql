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