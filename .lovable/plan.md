
This is a large multi-part request. Here's how I propose to ship it, broken into four independently-reviewable pieces. Tell me which to start with (or "all" to go in order).

---

## 1. SSO for organizations (SAML + Google Workspace)

**Approach**: Lovable Cloud's managed SAML SSO is configured at the **project level**, not per-org. True per-org SAML (each firm brings its own IdP) requires Supabase's `sso_providers` API and domain-based routing — which works on Lovable Cloud, but the IdP metadata must be added by you (or a Weybre super-admin) per tenant since end users can't self-serve it without exposing the service-role key.

What I'll build:
- `organization_sso` table: `{ organization_id, provider: 'saml'|'google_workspace', email_domain, sso_provider_id (Supabase), hd (Google hosted domain), default_role: org_role, is_active }`.
- **Google Workspace mode**: org admin enters their `@firm.com` domain → sign-in button calls `lovable.auth.signInWithOAuth("google", { extraParams: { hd: "firm.com" }})`. On callback, an edge function `sso-postlogin` matches the user's email domain → adds them to the org with `default_role` if not already a member. Uses the existing managed Google OAuth — no new credentials.
- **SAML mode**: org admin pastes IdP metadata URL + email domains in the Organizations UI → an edge function `org-sso-register` calls Supabase Admin API to register a `sso_providers` entry tagged with org-scoped metadata. Sign-in routes via `signInWithSSO({ domain })`. Same `sso-postlogin` handles RBAC mapping.
- **RBAC mapping**: SAML attribute `role` (or Google Workspace group claim if provided) → mapped to `org_role` via a per-org `sso_role_mappings` JSON column. Falls back to `default_role`.

Limits to flag: full SCIM/JIT provisioning is out of scope; we do JIT on first login only.

## 2. Organization-level audit log

- `audit_logs` table: `{ id, organization_id, actor_user_id, actor_email, action (text), resource_type, resource_id, metadata jsonb, ip, user_agent, created_at }`. Indexed on `(organization_id, created_at desc)` and `actor_user_id`.
- RLS: org admins/owners can read their org's logs; system inserts via security-definer function `log_audit_event(...)` only.
- Triggers on `organization_members` (role change, add, remove) and `organization_invites` (created, accepted, revoked) → call `log_audit_event`.
- Edge functions (`contract-intake`, `research`, `draft`, `diligence-*`) get a one-line call to `log_audit_event` for "data access" events when an `organization_id` is supplied.
- New page `/organizations/audit` with filters: actor (dropdown of org members), action type, date range, free-text search. Server-side paginated.

## 3. Judgments dataset ingestion — `Hibbaan/indian-case-laws`

The HF Python `load_dataset` SDK can't run inside Lovable Cloud (no Python runtime in edge functions). Two viable paths:

- **(A) HF Datasets Server REST API** — works from a Deno edge function. I'll extend the existing `ingest-judgments` function with a `source: "hf"` mode that streams rows from `https://datasets-server.huggingface.co/rows?dataset=Hibbaan/indian-case-laws&...` in batches, normalizes them into the `judgments` schema (title, citation, court, judges, decision_date, full_text), generates embeddings via Lovable AI (`google/text-embedding-004`), and upserts. Resumable via `offset`. **No API key needed** for public datasets.
- **(B) One-time bulk via a local script** I write under `/tmp` and run with `code--exec` (with `psql` + `huggingface_hub` over HTTP). Faster initial load but you can't re-trigger from the admin UI.

I recommend **A + a "Run HF Sync" button** on `AdminOverview`. Tell me if you want B instead.

Caveat I need to flag before building: I don't know this dataset's schema. I'll fetch the first batch, inspect columns, and adapt the mapping in the same step — but if column names don't include something like `judgment_text`/`case_title`/`court`/`date`, the mapping will need manual tuning.

## 4. Security fixes (all 6 findings)

One migration:
- **`user_roles` privilege escalation**: add `FOR INSERT/UPDATE/DELETE TO authenticated WITH CHECK (has_role(auth.uid(),'admin'))` so only existing admins can mutate roles. The seeded admin (`mababwbi@gmail.com`) stays the bootstrap.
- **`usage_events`**: add `INSERT WITH CHECK (user_id = auth.uid())`; no UPDATE/DELETE policies (server-side functions use service role).
- **`organization_invites`**: add SELECT policy `email = (select email from auth.users where id = auth.uid())` so invitees can read their own invite.
- **Realtime channel auth**: add policy on `realtime.messages` restricting topics matching `contracts:<uuid>`, `diligence_documents:<uuid>`, `diligence_cells:<uuid>` to rows the user owns. Frontend code that subscribes to these tables will be updated to use scoped topic names.
- **SECURITY DEFINER functions exposed to anon/authenticated**: `REVOKE EXECUTE ... FROM anon` on `accept_organization_invite`, `has_role`, `has_org_role`, `is_org_member`, `handle_new_user`, `handle_new_organization`, `search_judgments`, `judgments_tsv_trigger`, `handle_updated_at`. Keep `EXECUTE` to `authenticated` only where the function is intentionally called from the client (`accept_organization_invite`, `search_judgments`).

---

**Suggested order**: 4 (security, ~5 min) → 2 (audit log, ~15 min) → 1 (SSO, ~30 min) → 3 (dataset ingestion, ~15 min + sync time).

Reply with which piece(s) to execute, or **"all in order"** and I'll ship them sequentially.
