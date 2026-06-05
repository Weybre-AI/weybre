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
