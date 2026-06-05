# Architecture V2: Enterprise Target State

## 1. System Architecture Diagram (Logical)

### Current State (The Serverless Monolith)
`[React SPA] --> [Supabase PostgREST + Edge Functions] --> [Single Postgres DB (Data + Queue + Vectors)]`

### Target State (The Enterprise Decoupled Architecture)

**Tier 1: Edge & Application**
- **CDN / WAF:** Cloudflare Enterprise (DDoS protection, WAF rules).
- **Frontend:** Vite/React SPA hosted on Vercel/AWS S3+CloudFront, aggressively code-split.
- **API Gateway:** AWS API Gateway or Kong (handles rate limiting, auth translation, idempotency).

**Tier 2: Core Services (Microservices)**
- **Auth & Tenant Service:** Supabase Auth (retained for speed, but wrapped by Gateway).
- **Core API Service:** Node.js/Express or Go service handling Matter Management, Collaboration, and DB transactions. Replaces complex Supabase RPCs.

**Tier 3: The AI & Document Pipeline (Asynchronous)**
- **Event Bus:** Amazon SQS / EventBridge.
- **Ingestion Workers:** AWS ECS Fargate tasks (Python) running `unstructured.io` for robust legal PDF parsing.
- **Embedding Workers:** Dedicated GPU instances or API abstractions for batch embedding generation.
- **Storage:** Amazon S3 (with KMS CMK encryption) replacing plain Supabase Storage.

**Tier 4: Data Layer (Polyglot Persistence)**
- **Primary OLTP:** Amazon RDS for PostgreSQL (Multi-AZ) or Supabase Dedicated. Handles pure relational data (`matters`, `users`, `billing`).
- **Vector Search:** Pinecone or Qdrant cluster. Handles `judgment_chunks` and contract embeddings.
- **Telemetry Store:** Elasticsearch / OpenSearch for `audit_logs` and `usage_events`.

---

## 2. Infrastructure Changes

### Components to Migrate & Add
1. **AWS SQS:** Create queues: `doc-ingest-queue`, `doc-ocr-queue`, `rag-embed-queue` with associated DLQs.
2. **AWS ECS / EKS:** Deploy long-running Python worker containers.
3. **AWS KMS:** Create Key Management infrastructure for Tenant CMKs.
4. **Qdrant/Pinecone:** Provision dedicated vector environment.

### Cost & Throughput Comparison: Queue Architectures
**BullMQ (Redis) vs. SQS**
- *BullMQ:* High throughput, easy to integrate with Node, but requires managing a highly available Redis cluster (expensive at scale).
- *Amazon SQS:* Practically infinite throughput, fully managed, built-in DLQs, pay-per-request.
- **Decision:** **SQS**. Enterprise readiness demands zero-maintenance message durability over minor latency gains.

---

## 3. Database Changes (Schema & Migrations)

### Files to Delete
- `supabase/functions/vision-ocr/*`
- `supabase/functions/document-worker/*`
- `supabase/functions/ingest-judgments/*`
- `supabase/migrations/*_async_queues.sql` (Drop `processing_jobs` and `async_jobs` tables).

### Schema Updates (Migrations to Create)
1. **Migration: `drop_legacy_queues.sql`**
   - Drops `processing_jobs`, `async_jobs`.
2. **Migration: `partition_audit_logs.sql`**
   - Refactors `audit_logs` to native partitioning.
3. **Migration: `matter_ethical_walls.sql`**
   - Creates `matter_access_grants` table linking `user_id`, `matter_id`, and `access_level`.
   - Re-writes RLS policies on `matters` to join against `matter_access_grants`.
4. **Migration: `add_kms_metadata.sql`**
   - Adds `kms_key_id` to `organizations`.
   - Modifies `contracts.full_text` to store `bytea` (encrypted payload) instead of `text`.

---

## 4. API Changes

### Deprecated
- Direct client-side inserts to `processing_jobs`.
- Supabase Edge Functions for heavy processing.

### New Endpoints
- `POST /api/v1/documents/upload`: Returns a presigned S3 URL.
- `POST /api/v1/documents/process`: Enqueues an SQS message with the S3 URI and KMS Key ID.
- `GET /api/v1/documents/{id}/status`: Reads from an optimized Redis cache updated by the workers.

---

## 5. Implementation Guidance: Replace Edge Worker Architecture

**Worker Design Pattern:**
1. **Pull:** Python Worker polls SQS `doc-ingest-queue`.
2. **Decrypt:** Worker fetches file from S3, uses KMS to decrypt bytes in memory.
3. **Process:** OCR / Semantic Chunking via `unstructured` and `spaCy`.
4. **Embed:** Batched calls to LLM embedding API.
5. **Store:** Upsert vectors directly to Pinecone/Qdrant. Write metadata to Postgres via transactional API.
6. **Acknowledge:** Delete SQS message.

**Failure Recovery:**
- If OCR fails due to malformed PDF, throw exception. SQS Visibility Timeout expires, message goes back to queue.
- After 3 retries, message moves to DLQ.
- Alerting triggers on DLQ depth > 0. Support team manually reviews the malformed file.