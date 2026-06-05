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
