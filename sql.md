# Database Architecture & SQL Analysis

## Full Database Schema Explanation
The database leverages PostgreSQL as a massive monolithic data store, queue, and vector search engine.
- **Core Entities:** `profiles`, `organizations`, `subscriptions`, `billing_plans`.
- **Domain Entities:** `matters`, `contracts`, `drafts`, `draft_versions`, `clause_library`, `judgments`, `judgment_citations`.
- **RAG Engine:** `judgment_chunks` (contains `tsv` for FTS and `embedding` for vector math), `rag_cache`.
- **Telemetry & Logs:** `audit_logs`, `usage_events`, `billing_events`, `credit_transactions`.
- **Job Queues:** `processing_jobs`, `async_jobs`.

## Table Relationships
The schema heavily relies on cascading multi-tenancy. Most domain tables link back to a `user_id` or `organization_id`. The addition of the `processing_jobs` table uses polymorphic-like relations (`resource_id`, `resource_type`) which inherently drops strict Foreign Key constraints, risking orphaned job records.

## Data Integrity Risks
- **Polymorphic Queues:** `processing_jobs` lacks hard FKs to the underlying resources (drafts, contracts, matters). If a user deletes a contract while a job is queued, the worker will fail or create ghost data.
- **RAG Consistency:** The `judgment_chunks` table cascades on delete from `judgments`, but maintaining sync between the `tsv` (Full Text Search) and `embedding` (Vector) columns relies on a trigger (`judgment_chunks_tsv_update`). If the LLM embedding fails during an update, the chunk is semantically out of sync with its text.

## Inefficient Queries & Missing Indexes
- **The Queue Anti-Pattern:** Using Postgres as a queue (`processing_jobs`) without specialized handling (like `SKIP LOCKED`) leads to massive row contention and deadlocks when multiple workers poll the table simultaneously. 
- **Vector Search Joins:** Searching via the RRF function (`hybrid_legal_search`) requires sorting the entire `judgment_chunks` table by vector distance, sorting again by text match, and then joining. Even with HNSW indexes, filtering vectors *after* a multi-tenant `WHERE organization_id = X` clause degrades performance because the vector index is globally constructed, forcing Postgres into a slow sequential scan fallback.
- **Unpartitioned Event Tables:** `audit_logs`, `usage_events`, and `credit_transactions` have standard B-Tree indexes but no table partitioning. In an enterprise system, these tables will grow to tens of millions of rows in months, degrading insert performance and ballooning database memory usage.

## Scaling Risks
- **Connection Exhaustion:** React clients opening real-time subscriptions (`realtime.messages`) combined with heavily concurrent edge workers polling the database will rapidly exhaust the Postgres connection pool (even with Supavisor/PgBouncer).
- **CPU Starvation:** Running heavy HNSW graph traversals, GIN index text searches, and complex RLS policy evaluations on the same database CPU that handles core CRUD operations will lead to a complete system lockup under sudden enterprise load.