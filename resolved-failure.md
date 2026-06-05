# Resolved Failure Report: Enterprise Remediation

This document provides the definitive architectural solutions and remediation plans for the top 10 critical failures identified in `failure.md`.

## 1. Evict Async Workers (The Serverless Trap)

### Current State
Heavy document processing (`vision-ocr`, `document-worker`) runs in Supabase Edge Functions (Deno), subject to strict CPU/Memory and timeout limits. 

### Target State
A dedicated, long-running Compute Cluster (e.g., AWS ECS Fargate or Kubernetes) running Python/Node worker containers optimized for ML and memory-intensive document processing.

### Why Current Design Fails
Law firm uploads routinely exceed 500 pages. Edge functions OOM or timeout silently, dropping tasks and leaving the system in an inconsistent state.

### Why New Design Wins
Containerized workers scale horizontally, have unbound execution time, and can utilize specialized hardware (GPUs for OCR/Embeddings).

## 2. Implement a Real Message Broker (The Queue Anti-Pattern)

### Current State
`processing_jobs` table in Postgres used as a polling queue via DB triggers.

### Target State
Amazon SQS (or managed Redis with BullMQ) handling all asynchronous event orchestration.

### Why Current Design Fails
High-frequency polling and row-locking on the Postgres table causes severe CPU spikes and transaction deadlocks, impacting web CRUD performance.

### Why New Design Wins
SQS provides infinite throughput, built-in dead-letter queues (DLQ), exponential backoff for retries, and completely offloads queue management CPU from the primary database.

## 3. Client Bundle Code-Splitting (Client-Side Overload)

### Current State
Monolithic React build parsing PDFs in the browser using `pdfjs-dist` and `mammoth`.

### Target State
Vite/React bundle using `React.lazy()` for route splitting. All PDF parsing shifted strictly to the backend workers.

### Why Current Design Fails
Mid-tier corporate laptops crash from massive DOM and Memory bloat when parsing large legal exhibits in the main browser thread.

### Why New Design Wins
Initial load times drop to milliseconds. Browsers only render UI. Compute is centralized on backend servers designed for it.

## 4. Implement Field/Tenant Level Encryption (Data-at-Rest)

### Current State
Confidential contracts stored as plain text in `TEXT` columns in a multi-tenant DB.

### Target State
Integration with AWS KMS or HashiCorp Vault. Application-level envelope encryption before data hits Postgres, using tenant-specific Customer Managed Keys (CMKs).

### Why Current Design Fails
Violates strict AmLaw 100 client confidentiality agreements. A single DB compromise leaks all firms' data.

### Why New Design Wins
Allows Bring Your Own Key (BYOK). If a firm churns or is breached, their specific KMS key is revoked, cryptographically shredding their data instantly without affecting others.

## 5. Partition Event Tables (Database Bloat)

### Current State
`audit_logs`, `usage_events` grow unbounded with simple B-Tree indexes.

### Target State
PostgreSQL native declarative partitioning by `RANGE (created_at)` per month.

### Why Current Design Fails
As event tables hit 100M+ rows, index updates during INSERTs slow down exponentially, dragging down the entire DB performance.

### Why New Design Wins
Writes remain fast as they only hit the active month's partition. Historical data can be easily archived or dropped without massive `DELETE` locks.

## 6. Decouple Vector Search (CPU Starvation)

### Current State
PostgreSQL running web CRUD, 90+ RLS policies, and heavy HNSW vector math simultaneously.

### Target State
A dedicated Vector Database (e.g., Pinecone or dedicated Qdrant cluster) or a Read-Only pgvector replica.

### Why Current Design Fails
Vector similarity search is highly CPU/RAM intensive. A burst of RAG queries will pin the primary DB CPU at 100%, causing the entire platform to timeout.

### Why New Design Wins
Isolates compute domains. Web traffic hits the OLTP Postgres. RAG queries hit the Vector Store.

## 7. Redesign RLS for Ethical Walls (Information Barriers)

### Current State
Access is binary: user-level or organization-level. 

### Target State
A `matter_access` join table defining explicit User-to-Matter grants (Owner, Editor, Viewer, Blocked), enforced via optimized RLS policies.

### Why Current Design Fails
Firms cannot block conflicted lawyers from specific matters within the same firm workspace.

### Why New Design Wins
Strict compliance with legal ethical walls. Changes are auditable at the matter level.

## 8. Fix RAG Chunking Strategy

### Current State
Naive text splitting (likely paragraph-based) by the document worker.

### Target State
Semantic sliding-window chunking (e.g., 500 tokens with 100 token overlap) preserving structural metadata (headings, page numbers).

### Why Current Design Fails
Legal context is frequently split across boundaries. The LLM loses the connection between a "Rule" on page 2 and its "Application" on page 3.

### Why New Design Wins
Overlap ensures continuity of thought. Structural metadata allows the LLM to provide precise citations.

## 9. Explicit Transaction Boundaries (Race Conditions)

### Current State
Multi-step processes (upload, bill credit, create record) happen across decoupled edge functions without ACID guarantees.

### Target State
Strict backend APIs using Postgres `BEGIN...COMMIT` blocks for atomic operations, combined with idempotency keys.

### Why Current Design Fails
If an edge function fails mid-execution, a user might be billed a credit without the document being successfully processed.

### Why New Design Wins
Data integrity is mathematically guaranteed. Idempotency prevents double-billing on retries.

## 10. E2E Testing for Long Polling (Resilience Validation)

### Current State
E2E tests likely assume happy-path, fast responses.

### Target State
Playwright/Cypress tests explicitly simulating 15-minute backend OCR jobs, validating polling UI, and gracefully handling simulated backend 500s.

### Why Current Design Fails
The UI breaks or shows infinite spinners when backend tasks take longer than expected, leading to high support ticket volume.

### Why New Design Wins
Ensures the UI degrading gracefully and keeping the user informed of long-running job states.