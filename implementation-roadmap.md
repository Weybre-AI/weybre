# Implementation Roadmap

This roadmap details the phased execution plan to transform the prototype into the V2 Enterprise Architecture.

## Phase 1: Stability & Security (Weeks 1-4)
*Goal: Stop the bleeding. Prevent outages and secure the data.*

1. **Week 1: Kill the Serverless Trap**
   - Provision AWS SQS and ECS.
   - Port `vision-ocr` and `document-worker` TypeScript/Deno code to a robust Python/Node containerized worker.
   - Refactor frontend to upload directly to S3/Storage, dropping client-side PDF parsing.
2. **Week 2: Database Queue Eradication**
   - Write migration to drop `processing_jobs` and `async_jobs`.
   - Implement backend API to enqueue tasks to SQS.
   - Remove DB polling triggers.
3. **Week 3: Code-Splitting & Frontend Optimization**
   - Implement `React.lazy()` for all major routes in `App.tsx`.
   - Remove `mammoth`, `jspdf`, `pdfjs-dist` from the main bundle.
4. **Week 4: Foundational Security**
   - Implement envelope encryption for new contract uploads via KMS.
   - Draft and enforce strict RLS policies for basic tenant isolation.

## Phase 2: Scalability & Architecture (Weeks 5-8)
*Goal: Prepare the system for 10,000 concurrent users.*

1. **Week 5: Vector Search Decoupling**
   - Provision Qdrant or Pinecone.
   - Write scripts to backfill existing `pgvector` embeddings to the new vector store.
   - Update `hybrid_legal_search` RPC / API to query the external vector DB instead of Postgres.
2. **Week 6: Database Partitioning & Maintenance**
   - Execute partitioning migrations for `audit_logs` and `usage_events`.
   - Implement PgBouncer/Supavisor for connection pooling.
3. **Week 7: Ethical Walls (Information Barriers)**
   - Roll out the `matter_access_grants` schema.
   - Update all APIs and RLS to respect matter-level permissions.
   - Build the Admin UI for managing ethical walls.
4. **Week 8: Performance Testing**
   - Run K6 / Locust load tests simulating 10k users.
   - Tune index parameters, connection limits, and worker auto-scaling triggers.

## Phase 3: Enterprise Product Features (Weeks 9-14)
*Goal: Build the features required to close AmLaw 100 deals.*

1. **Weeks 9-10: Trust & Explainability UI**
   - Implement exact bounding-box highlighting in the PDF viewer for RAG citations.
   - Overhaul the RAG prompt to enforce strict IRAC compliance and citation format.
2. **Weeks 11-12: Private Precedent Library**
   - Enable firms to ingest bulk historical zip files.
   - Implement tenant-isolated vector namespaces.
   - Build unified search UI (Public Judgments + Private Knowledge).
3. **Week 13: Advanced Collaboration**
   - Upgrade the `DraftEditor` to support real-time presence and basic version merging.
   - Lay groundwork for the MS Word Add-in API.
4. **Week 14: Enterprise Admin & SSO**
   - Polish the audit log viewer for compliance officers.
   - Finalize SAML/SSO JIT provisioning flows.

## Phase 4: Operations & Compliance (Weeks 15-16)
*Goal: Ensure the system can be operated safely by a dedicated SRE team.*

1. **Week 15: Observability**
   - Finalize Datadog/NewRelic dashboards.
   - Configure PagerDuty alerting for DLQ depth, API 500s, and DB CPU.
2. **Week 16: Compliance Audits**
   - Conduct external penetration testing.
   - Begin SOC 2 Type II observation period.
   - Finalize Runbooks and Disaster Recovery plans.