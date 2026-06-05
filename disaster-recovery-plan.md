# Disaster Recovery (DR) Plan

## 1. Objectives
- **Recovery Point Objective (RPO):** 5 Minutes. (Maximum acceptable data loss).
- **Recovery Time Objective (RTO):** 4 Hours. (Maximum time to restore full service in a new region).

## 2. Backup Strategy

### Relational Database (PostgreSQL)
- **Continuous:** Write-Ahead Logging (WAL) archiving to AWS S3 via WAL-G or pgBackRest. Allows Point-in-Time Recovery (PITR) up to the last 5 minutes.
- **Daily:** Full logical dumps stored in S3 (cross-region replication enabled).

### Vector Store (Pinecone/Qdrant)
- Daily snapshot backups. Vectors can technically be regenerated from the raw text in Postgres, but rebuilding millions of vectors takes days. Snapshots are required for fast RTO.

### Object Storage (PDFs/Contracts)
- S3 buckets configured with Cross-Region Replication (CRR) and Versioning. Object Lock enabled to prevent accidental or malicious deletion (Ransomware protection).

## 3. Disaster Scenarios & Failover Execution

### Scenario A: Primary Database Corruption or Ransomware
1. **Declare SEV-1.** Stop all web and worker traffic.
2. **Execute PITR:** Restore the RDS database from WAL logs to the exact minute *before* the corruption occurred.
3. **Verify:** Run data integrity checks against known good states.
4. **Restore Traffic.**

### Scenario B: Complete AWS Region Outage (e.g., us-east-1 goes dark)
1. **Declare SEV-1.**
2. **Update DNS/Routing:** Point Cloudflare / Global Accelerator to the warm standby region (e.g., `us-west-2`).
3. **Promote Replicas:**
   - Promote the cross-region Postgres read-replica in `us-west-2` to Primary.
   - If using S3 CRR, the bucket in `us-west-2` is already populated. Update app config to point to the new bucket.
4. **Deploy Compute:** Trigger CI/CD pipeline to deploy the API services and ECS Workers to the `us-west-2` region.
5. **Restore Traffic.** Expected execution time: ~1-2 hours depending on DB promotion speed.

## 4. Annual DR Testing
- A full cross-region failover simulation (Game Day) must be conducted annually.
- The results must be documented to satisfy ISO 27001 and SOC 2 requirements.