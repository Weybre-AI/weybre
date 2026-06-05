# Weybre AI: Architecture & System Overview

## What this system actually is
Weybre is a B2B multi-tenant SaaS platform tailored for the Indian legal market, designed to automate legal research, contract intake, and document drafting via a Retrieval-Augmented Generation (RAG) pipeline. It acts as an AI co-counsel, indexing Indian court judgments and processing user-uploaded confidential legal matters.

## Architecture Overview
- **Frontend:** React SPA built with Vite, TypeScript, Tailwind CSS, and shadcn/ui. Routing is handled by `react-router-dom` in a monolithic `App.tsx`. State and data fetching via React Query and Supabase JS client.
- **Backend/API:** Supabase (PostgREST API) serving as a Backend-as-a-Service, heavily relying on Row Level Security (RLS) for multi-tenant isolation.
- **Compute Layer:** Supabase Edge Functions (Deno) orchestrate everything from billing (Stripe/Razorpay/Dodo), SSO registration, to complex AI document workflows (`decision-engine`, `document-worker`, `vision-ocr`, `research`).
- **Database:** PostgreSQL with `pgvector` for embedding storage (HNSW/IVFFlat indexes) and full-text search (GIN indexes).
- **Storage:** Supabase Storage for storing PDFs, contracts, and attachments.

## Core Modules and Responsibilities
1. **Legal Knowledge Base (RAG):** Manages `judgments`, semantic `judgment_chunks`, and `judgment_citations`. Uses a dual-path retrieval strategy (Reciprocal Rank Fusion) combining pgvector cosine similarity and full-text keyword search.
2. **Case/Matter Management:** Organizes user workflows into `matters`, `drafts`, `draft_versions`, and `contracts`.
3. **Enterprise & Multi-Tenancy:** Manages organizations, RBAC (`user_roles`, `app_role`), SSO (`organization_sso`), and Microsoft 365 integrations (`teams_posts`, `sharepoint_exports`).
4. **Billing & Credits:** A granular credit-based usage system alongside recurring subscriptions (`billing_plans`, `credit_transactions`, `credit_costs`, `enterprise_invoices`).
5. **Async Processing Pipeline:** A custom database-backed queue (`processing_jobs`, `async_jobs`) meant to handle heavy ingestion, OCR, and AI analysis offline.

## Data Flow (Request → Processing → Storage → Response)
1. **Ingestion:** User uploads a contract or requests legal research via the React UI.
2. **Orchestration:** The React client directly inserts a record into `processing_jobs` or triggers an Edge Function (e.g., `contract-intake`).
3. **Async Processing:** A database trigger (`on_job_queued`) likely signals an Edge Function or external worker, which pulls the job, downloads the file from Storage, performs OCR (`vision-ocr`), chunks the text, calls an external LLM for embeddings/analysis, and writes back to `judgment_chunks` or `contracts`.
4. **Retrieval:** A user queries the system; the frontend calls an RPC function (`hybrid_legal_search`) that executes RRF in Postgres, returning augmented context to the LLM (`research` edge function) to stream the final answer back to the UI.
5. **Telemetry/Audit:** All actions write to `audit_logs` and `usage_events` for enterprise compliance and billing.