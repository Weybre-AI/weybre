# Product & Commercial Teardown

## The Real Product
Weybre is an AI-powered legal copilot and document automation pipeline designed to drastically reduce the hours Indian lawyers spend on precedent research, contract diligence, and drafting.

## Target Audience & Economics
- **Who Pays:** Mid-to-large Indian law firms (Tier 1/Tier 2), independent litigators with high caseloads, and enterprise in-house legal departments.
- **Operational Leverage:** Reduces the marginal cost of document review (OCR -> Chunking -> AI Diligence) and case-law retrieval from 10-20 billable hours down to 5 minutes of compute time. It protects margins for fixed-fee enterprise legal work.

## Feature Gaps vs Enterprise-Grade Platforms (The Reality Check)
Currently, Weybre is built like a prosumer SaaS, not an enterprise legal suite.
1. **Multi-User Collaboration:** True enterprise legal tech (like Harvey, Lexis+, or iManage) requires live red-lining, strict document checkout mechanisms, and explicit version merging. Weybre's `draft_versions` is primitive compared to real-time CRDTs or strict audit-compliant lock systems.
2. **Granular RBAC:** Enterprise firms require matter-level ring-fencing ("Ethical Walls"). The current schema relies on organization-wide or user-wide access. If Lawyer A is conflicted out of Matter X, the current DB schema (`matters` linked to `user_id` or `org_id` broadly) cannot easily isolate them without complex, fragile RLS updates.
3. **Bring Your Own Key (BYOK):** Law firms cannot legally store client contracts in a multi-tenant database without Tenant-Level Encryption (TDE). There is no sign of KMS integration or field-level encryption for the `contracts` or `matters` tables.

## Revenue Expansion Paths
1. **On-Prem / Single-Tenant Licensing:** The architecture must decouple to allow VPC deployments for top-tier law firms who outright refuse multi-tenant cloud storage.
2. **Private LLM Fine-Tuning:** Upsell custom instances fine-tuned on a specific firm's historical contract corpus, stored in a siloed vector index.
3. **API Monetization:** Expose the `ingest-judgments` and `hybrid_legal_search` pipelines as an API for legal tech startups or corporate compliance dashboards.

## The "10x Improvements" Required for Unavoidability
- **Explainability UI:** Legal AI fails when lawyers don't trust it. The UI must natively highlight the exact sentence in the original PDF source document (using bounding boxes) that generated the RAG answer.
- **Word / Outlook Add-ins:** Lawyers live in Microsoft Word. A standalone web app is friction. The existence of `sharepoint_exports` is a start, but a native Office 365 Add-in that queries the `hybrid_legal_search` directly from a Word document is mandatory for daily active use.