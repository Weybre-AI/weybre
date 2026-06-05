# Incident Response Plan (IRP)

## 1. Roles and Responsibilities
- **Incident Commander (IC):** Drives the incident, makes hard calls (e.g., taking the system offline).
- **Operations Lead:** Executes technical remediation (DB queries, infrastructure changes).
- **Communications Lead:** Drafts status page updates and customer communications.

## 2. Incident Classification Matrix
- **SEV-1 (Critical):** Complete platform outage, massive data loss, or active security breach. (SLA: 15 min response).
- **SEV-2 (High):** Core feature broken (e.g., RAG search failing, document ingestion completely stalled) for all users. (SLA: 30 min response).
- **SEV-3 (Medium):** Degradation of service (slow queries) or issue affecting a single tenant. (SLA: 2 hr response).

## 3. Playbook: Active Security Breach / Data Exfiltration

### Phase 1: Containment (Minutes 0-15)
1. **Identify the Scope:** Determine which tenant(s) or systems are compromised.
2. **Sever Access:**
   - If tenant-specific: Use Admin API or DB directly to lock the organization account. Disable all active sessions for that tenant.
   - If platform-wide (e.g., compromised admin token): **Initiate Kill Switch.** Shut down API Gateway / Cloudflare WAF to halt all external traffic. "Maintenance Mode."
3. **Revoke Credentials:** Immediately rotate DB passwords, AWS IAM keys, and internal API secrets via Vault/Secrets Manager.

### Phase 2: Eradication (Minutes 15-60)
1. Revoke the specific KMS Customer Managed Keys (CMKs) of affected tenants to render any exfiltrated encrypted blobs useless.
2. Review audit logs (`audit_logs`) to determine exactly what data was accessed and by which IP/Token.
3. Patch the vulnerability (e.g., fix the broken RLS policy or revoke the compromised Service Account).

### Phase 3: Recovery (Hours 1-4)
1. Bring API Gateway back online in a controlled manner.
2. Monitor logs intensely for returning attack vectors.
3. Communications Lead notifies affected enterprise clients per SLA requirements.

## 4. Playbook: Database Degradation / Lockup

### Phase 1: Containment
1. Check Datadog for CPU/IOPS metrics.
2. Run `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';` to find deadlocks.
3. Aggressively `pg_terminate_backend()` on blocking PIDs. Priority is to restore CRUD web traffic.

### Phase 2: Eradication
1. If the queue workers caused the lock, scale the ECS worker cluster down to 0 to halt DB polling.
2. Allow the DB to recover and clear its connection queues.

### Phase 3: Recovery
1. Slowly scale worker cluster back up.
2. Analyze the root cause query and deploy a missing index or query optimization hotfix.