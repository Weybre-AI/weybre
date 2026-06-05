# Codebase Breakdown & Quality Audit

## Module-by-Module Breakdown
- **Frontend Application (`src/`)**:
  - `pages/`: 25+ distinct views (e.g., MatterDetail, Intake, Litigation, Admin dashboards). Mix of user workflows and global admin views.
  - `components/`: UI library heavily relying on Radix/shadcn. Mixes pure UI with domain-specific wrappers (`AppShell`, `AdminShell`, `AiDisclaimer`).
  - `hooks/`: Domain logic extraction (`useAuth`, `useOrganizations`, `useProcessingJob`, `useSubscription`).
  - `lib/`: Utilities, notably `exportPdf.ts`, `extractText.ts` (client-side processing risks), and API wrappers (`invokeFunction.ts`).
- **Backend Compute (`supabase/functions/`)**:
  - Contains 17+ discrete serverless functions.
  - Mixes synchronous API endpoints (`manage-api-keys`, `create-dodo-checkout`) with heavy data processing (`document-worker`, `vision-ocr`, `ingest-judgments`).

## Responsibilities & Hidden Coupling
- The monolithic `App.tsx` contains 30+ routes without lazy loading (`React.lazy`), tightly coupling the entire application bundle.
- **Hidden Coupling (Smell):** Edge functions likely share domain types and logic, but without a robust shared library setup (only a `_shared` folder is visible, which often leads to versioning drift if not strictly managed). 
- **Fat Client Pattern:** The presence of `extractText.ts` and `exportPdf.ts` in the frontend implies heavy processing is being pushed to the browser, potentially freezing the main thread on large legal PDFs.

## Security Vulnerabilities in Code
- **RLS Complexity:** There are 90+ Row Level Security policies across the database. Complex RLS logic (e.g., validating multi-tenant org membership via joins in policies) often causes profound performance degradation and introduces bypass vulnerabilities if subqueries aren't perfectly secured.
- **API Key Management:** The `api_keys` table and `manage-api-keys` function suggest users can generate tokens. If these tokens bypass RLS or authenticate as a service role incorrectly, it's a critical privilege escalation vector.
- **Client-Side Sentry Overexposure:** Tracing targets include `localhost` and `weybre.com` natively, but sample rates are high (100% on errors, 10% session). PII in legal documents could be inadvertently captured in session replays.

## Performance Bottlenecks & Scalability Limits
- **Edge Function Timeouts:** Supabase Edge Functions (Deno) have strict execution timeouts (typically 5-150 seconds depending on plan). Orchestrating long-running tasks like `vision-ocr` or massive `document-worker` chunking via HTTP-triggered serverless functions is an architectural anti-pattern that *will* result in silent timeouts for enterprise-size documents.
- **Monolithic Frontend Bundle:** A single Vite build without code-splitting the massive `pdfjs-dist`, `mammoth`, and `jspdf` libraries will result in a huge initial JS payload, heavily impacting First Contentful Paint (FCP) and Time to Interactive (TTI).
- **RAG Latency:** Running RRF (Reciprocal Rank Fusion) purely in Postgres across millions of chunks (`judgment_chunks`) and full-text vectors blocks the DB thread. At scale, this requires dedicated search infrastructure (e.g., Elasticsearch, Pinecone, or specialized pgvector hardware).