# The Brutal Truth: Production Failure Report

This system, in its current state, will catastrophic break when subjected to real-world enterprise legal load. It is fundamentally architected as a lightweight side-project, masking heavy, asynchronous, CPU-bound workloads behind fragile serverless functions and a single overloaded Postgres instance.

## Why this product will fail in production
1. **The Serverless Processing Trap:** Using Supabase Edge Functions (Deno) for `vision-ocr`, `document-worker`, and `contract-intake` is a fatal architecture flaw. Edge functions have strict memory (e.g., 256MB/512MB) and timeout limits. When a law firm uploads a 500-page scanned PDF exhibit, the OCR and chunking process will silently OOM or timeout, leaving zombie records in `processing_jobs`. 
2. **Database CPU Starvation:** You are relying on PostgreSQL to do *everything*: handle web CRUD, evaluate 90+ complex Row Level Security policies per query, run a custom async queue (`processing_jobs`), perform full-text search (GIN), and execute heavy HNSW vector math (`hybrid_legal_search`). Under simultaneous load from 50 lawyers running complex RAG queries while 10 documents are ingesting, Postgres CPU will pin at 100%, causing cascading connection timeouts across the entire platform.
3. **Client-Side Heavy Lifting:** The presence of `pdfjs-dist` and `mammoth` alongside `extractText.ts` in the frontend indicates the browser is parsing massive documents. This will crash Chrome tabs on mid-tier laptops (standard issue at law firms) when uploading heavy legal folios.

## Security & Compliance Risks (Dealbreakers)
- **No Ethical Walls (Information Barriers):** Law firms require strict matter-centric isolation. The database schema lacks the capability to easily wall off specific users from specific matters within the same organization without writing incredibly complex, slow RLS policies that are practically un-auditable.
- **No Data-at-Rest Encryption (BYOK/TDE):** Storing highly confidential enterprise contracts and litigation strategies in plain text `TEXT` columns in a multi-tenant DB violates strict client confidentiality agreements. A single database dump leak compromises all firms simultaneously.

## Top 10 Urgent Priorities (What must be fixed first)
1. **Evict Async Workers:** Immediately move `vision-ocr`, `document-worker`, and ingestion logic out of Edge Functions into a dedicated, long-running compute tier (AWS ECS, Render Background Workers, or Kubernetes) with high memory limits.
2. **Implement a Real Message Broker:** Delete the `processing_jobs` polling anti-pattern. Introduce Redis (BullMQ) or AWS SQS to handle document ingestion queues, retries, and dead-lettering safely.
3. **Client Bundle Code-Splitting:** Refactor `App.tsx` to use `React.lazy()` for all routes. Dynamically import heavy libraries (`pdfjs-dist`, `jspdf`) *only* when the user enters the specific drafting or document view.
4. **Implement Field/Tenant Level Encryption:** Use Postgres `pgcrypto` or a middleware service (like Vault) to encrypt the `content` and `full_text` columns of user-uploaded contracts at rest using tenant-specific keys.
5. **Partition Event Tables:** Apply Postgres declarative partitioning (by month) to `audit_logs`, `usage_events`, and `credit_transactions` before they bloat the database and destroy insert performance.
6. **Decouple Vector Search:** Monitor Postgres CPU closely. Plan the immediate migration of the `judgment_chunks` vector index to a dedicated vector database (Pinecone, Qdrant) or a logically replicated, read-only pgvector replica.
7. **Redesign RLS for Ethical Walls:** Refactor the schema to support Matter-Level permissions (e.g., a `matter_access` join table), rather than relying purely on user or organization-wide access.
8. **Fix RAG Chunking:** Ensure the `document-worker` implements overlapping sliding-window chunking, not just naive paragraph splitting, to prevent loss of legal context between chunks.
9. **Implement Explicit Transaction Boundaries:** Ensure that when a user creates a matter, uploads a file, and deducts credits, it happens in a strict ACID transaction. The current edge-function orchestration is highly susceptible to race conditions and out-of-sync credit billing.
10. **Add E2E Testing for Long Polling:** The testing suite (`test/e2e`) must explicitly validate the timeout and failure states of massive 100MB PDF uploads to ensure the UI gracefully handles backend OOMs.

## What to Delete
- Delete client-side document parsing (`extractText.ts` using `pdfjs-dist`). The frontend should *only* upload raw bytes to a presigned S3/Supabase Storage URL. The backend must do all the parsing.
- Delete the `processing_jobs` table and replace it with a standard external queue.

## What to Rebuild from Scratch
- The entire document ingestion and chunking pipeline. It must be rebuilt as an event-driven microservice independent of the Supabase API tier.