# Enterprise Security & Compliance Hardening

To support AmLaw 100 firms and Fortune 500 enterprises, the platform must transition from a "trust us" model to a "cryptographically verifiable" security posture.

## 1. Authentication & Authorization

### SSO & Identity Governance
- **Current:** Basic Supabase Auth with nascent SSO.
- **Target:** Full SAML 2.0 / OIDC integration (Okta, Azure AD, PingIdentity) via dedicated identity broker (e.g., WorkOS or Auth0).
- **Requirement:** Just-In-Time (JIT) provisioning must tie directly to firm Active Directory groups to automate onboarding and offboarding.

### Strict RBAC & Ethical Walls (Information Barriers)
- **Concept:** Law firms require strict ring-fencing of matters. If a firm represents Company A, lawyers previously representing Company A's competitor must be cryptographically and logically walled off from the matter.
- **Implementation:**
  - Create `matter_participants` table: `(matter_id, user_id, role, explicitly_blocked)`.
  - **RLS Policy:** `CREATE POLICY ethical_wall ON matters FOR SELECT USING (EXISTS (SELECT 1 FROM matter_participants WHERE matter_id = matters.id AND user_id = auth.uid() AND explicitly_blocked = false));`

## 2. Data Encryption & Key Management (BYOK)

### Application-Level Envelope Encryption
- **Why:** Transparent Data Encryption (TDE) at the Postgres disk level is insufficient; DB admins can still read the data.
- **How:**
  1. Firm registers and provisions an AWS KMS Customer Managed Key (CMK) ARN.
  2. The application generates a Data Encryption Key (DEK) via KMS.
  3. All contract text, drafts, and LLM generated summaries are encrypted in application memory using AES-256-GCM.
  4. Only the cipher text (`bytea`) and the encrypted DEK are stored in Postgres.
- **Vector Store Isolation:** Vector embeddings must be stored in logically separated namespaces or dedicated indices per tenant to prevent cross-tenant vector bleed.

## 3. Comprehensive Audit Logging

### Immutable Audit Trails
- **Requirement:** Every read, write, and search query must be logged.
- **Implementation:**
  - Logs must be shipped immediately to an immutable WORM (Write Once, Read Many) storage layer (e.g., AWS S3 Object Lock) or SIEM (Splunk, Datadog).
  - Schema: `(timestamp, actor_id, actor_ip, action_type, resource_id, resource_type, outcome)`.
- **Alerting:** Automated alerts for anomalous behavior (e.g., a single user downloading 1,000 contracts in an hour).

## 4. Incident Response & Secrets Rotation

### Secrets Management
- No API keys in `.env` files.
- All secrets (Stripe, LLM providers, DB passwords) stored in AWS Secrets Manager or HashiCorp Vault.
- Automated daily rotation of internal database credentials.

### Incident Response Protocol
- **Tier 1 (Detection):** Datadog anomaly alerts trigger PagerDuty.
- **Tier 2 (Containment):** "Kill switches" implemented via API Gateway to instantly block traffic from specific tenant IPs or disable specific user accounts.
- **Tier 3 (Eradication/Recovery):** Runbooks for rotating all KMS keys and API tokens.

## 5. Compliance Readiness Roadmap

- **SOC 2 Type II:** Requires 6 months of continuous audit logging, access review evidence, and change management controls (no direct commits to `main`, mandatory 2-person code review).
- **ISO 27001:** Requires formalized ISMS (Information Security Management System) policies, risk assessment matrices, and vendor management reviews.
- **GDPR / DPDP (India):** "Right to be forgotten" requires hard deletes across all relational tables, vector stores, and S3 buckets. Scripts must be written to cleanly purge a tenant's entire footprint upon contract termination.