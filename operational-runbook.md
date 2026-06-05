# Operational Runbook

This runbook defines the daily operations, metrics, and scaling triggers for the SRE/DevOps team managing the Weybre platform.

## 1. Core Service Level Indicators (SLIs)
Monitor these metrics constantly on the main dashboard (Datadog/Grafana):
- **Web API Error Rate (5xx):** Target < 0.1%.
- **P95 API Latency:** Target < 250ms for CRUD, < 2s for RAG Search.
- **Database CPU Utilization:** Target < 60% sustained.
- **SQS Queue Depth (doc-ingest-queue):** Alert if age of oldest message > 5 minutes.
- **Worker Memory Utilization:** Alert if > 85% (pre-OOM warning).

## 2. Scaling Triggers & Actions

### Trigger: Queue Depth Spiking
- **Symptom:** `doc-ingest-queue` depth grows rapidly; oldest message age exceeds 5 minutes.
- **Action:** ECS Auto-scaling should trigger. If manual intervention is needed, update ECS service desired task count: `aws ecs update-service --cluster weybre-prod --service doc-worker --desired-count 20`.

### Trigger: Database CPU > 80%
- **Symptom:** Postgres is struggling. P95 latency across all web routes degrades.
- **Action:**
  1. Check `pg_stat_activity` for long-running locks or blocked queries.
  2. Kill runaway vector search queries if necessary: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query ILIKE '%hybrid_legal_search%' AND state = 'active' AND duration > interval '10 seconds';`
  3. Ensure PgBouncer is not queuing connections excessively.

### Trigger: LLM API Rate Limits (429s)
- **Symptom:** AI features failing, logs show OpenAI/Anthropic 429 Too Many Requests.
- **Action:** Manually flip the feature flag in the admin portal to route traffic to the secondary fallback provider (e.g., Azure OpenAI) until quotas reset.

## 3. Daily / Weekly Maintenance Tasks

### Daily
- Review Dead Letter Queues (DLQ). Identify why documents failed processing (corrupt PDF, password protected, extreme length). Requeue or mark as failed and notify user.
- Review daily backup success logs for Postgres and Vector stores.

### Weekly
- Rotate AWS IAM keys for worker roles.
- Review anomalous access logs (e.g., sudden spikes in data export by specific users).
- Run `VACUUM ANALYZE` on heavily updated tables (if auto-vacuum is falling behind).