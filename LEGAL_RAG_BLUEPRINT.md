# Weybre AI: Hybrid Legal RAG System Blueprint
**Version:** 1.0 (Production-Grade)
**Architect:** Principal AI Architect

## 1. System Architecture Overview
The Weybre Legal RAG (Retrieval-Augmented Generation) system is designed as a multi-stage pipeline that transforms unstructured Indian court judgments into a structured, searchable, and reason-capable knowledge base.

### 1.1 Ingestion & Processing Pipeline (Logical)
1.  **Source Adapters:** Connectors for High Courts, Supreme Court (SCI), and Tribunals.
2.  **Normalization Engine:** Extracts structured fields (Bench, Judges, Date, Citations) using regex and LLM-based layout parsing.
3.  **Semantic Chunking:** Documents are split into `JudgmentChunks` based on semantic boundaries (e.g., *Summary of Facts*, *Issues*, *Holding*, *Ratio Decidendi*) rather than arbitrary token counts.
4.  **Embedding Generation:** Each chunk is embedded using `text-embedding-004` (optimized for long-form retrieval).
5.  **Graph Enrichment:** Citations are extracted and linked in a `CitationGraph` (Initiative 1).

## 2. Database Schema (Hybrid Index)

### 2.1 `judgment_chunks` Table
Stores the granular semantic fragments used for retrieval.
```sql
CREATE TABLE public.judgment_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judgment_id UUID NOT NULL REFERENCES public.judgments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL, -- 'fact', 'issue', 'holding', 'precedent_ref'
    sequence_order INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Includes specific page_ref, section_heading
    embedding extensions.vector(1536), -- Vector layer
    tsv extensions.tsvector, -- Keyword layer
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.2 Global Hybrid Search Function
Uses **Reciprocal Rank Fusion (RRF)** to merge semantic similarity with keyword matches.
```sql
CREATE OR REPLACE FUNCTION public.hybrid_legal_search(
    query_text TEXT,
    query_embedding extensions.vector(1536),
    match_count INT DEFAULT 10,
    filter_metadata JSONB DEFAULT '{}'::jsonb
)
-- Returns merged chunks with case-level metadata
```

## 3. Retrieval Strategy: Dual-Path + RRF
1.  **Semantic Path:** Cosine similarity on `judgment_chunks.embedding`.
2.  **Keyword Path:** Full-text search on `judgment_chunks.tsv` (optimized for Citations and Statute numbers).
3.  **Fusion:** RRF merges top-100 from both paths.
4.  **Metadata Hard-Filters:** Applied at the database level (e.g., `WHERE court = 'Supreme Court'`).

## 4. Context Construction & Prompting

### 4.1 Structured Context Builder
Retrieved chunks are grouped by `judgment_id` to provide the LLM with a coherent view of each case.
- **Header:** [Case Name] | [Court] | [Date]
- **Body:** Chunks sorted by `sequence_order` with explicit `[Excerpt]` markers.

### 4.2 Legal-Grade Prompt (Grounding)
```text
You are Weybre AI Co-Counsel. Answer the query using ONLY the provided CONTEXT.
1. Strictly follow IRAC (Issue, Rule, Application, Conclusion).
2. Cite every proposition using [n] where n is the context source number.
3. Distinguish between Ratio Decidendi (binding) and Obiter Dicta (persuasive).
4. If the context is insufficient, state: "No binding precedent found."
```

## 5. Performance & Scaling
- **Distributed Workers:** Ingestion workers run in a K8s cluster, processing judgments in parallel batches.
- **Query Caching:** Redis cache for embedding vectors of common queries.
- **Index Optimization:** `ivfflat` or `HNSW` indexes for high-speed vector retrieval over 1M+ chunks.

## 6. Evaluation (RAGAS Framework)
- **Faithfulness:** Does the answer derive purely from the context?
- **Answer Relevance:** Does it address the specific legal issue?
- **Context Precision:** Are the retrieved chunks actually relevant?
- **Citation Accuracy:** Automated verification of [n] markers against context IDs.

---
*Blueprint Approved for Phase 2 implementation.*
