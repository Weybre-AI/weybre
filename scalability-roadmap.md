# Scalability Engineering Roadmap

Simulation and remediation plans for scaling the platform from initial product-market fit to enterprise dominance.

## Phase 1: 1,000 Concurrent Users (The Threshold)

### Bottlenecks & Saturation Points
- **Postgres Connection Pool:** 1,000 active users making concurrent API calls will exhaust the default Supabase connection pool (usually capped at 500-1000).
- **Vector Search Latency:** Full table scans on `judgment_chunks` (even with indexes) will start to exceed 500ms.

### Remediation
1. **Connection Pooling:** Implement PgBouncer or Supavisor at the connection layer. Route all read-only queries to a read-replica.
2. **Vector Index Optimization:** Ensure `pgvector` HNSW index parameters (`m`, `ef_construction`) are tuned. Pre-warm caches for frequent queries.
3. **Static Asset Caching:** Ensure all React assets and public CMS pages are aggressively cached at the Cloudflare edge.

## Phase 2: 10,000 Concurrent Users (Enterprise Scale)

### Bottlenecks & Saturation Points
- **Database CPU:** The sheer volume of CRUD operations, combined with complex RLS policy evaluations per row, will pin the primary database CPU.
- **Async Queue Backpressure:** If 1,000 lawyers upload 10 documents each simultaneously, the SQS queue will balloon. Worker scaling may hit API rate limits with LLM providers (e.g., OpenAI token limits).
- **Realtime Websockets:** 10,000 active WebSocket connections for UI updates will saturate a single Node/Deno instance.

### Remediation
1. **Decouple Vector Search:** Execute the migration to a dedicated Vector DB (Qdrant/Pinecone). Remove `pgvector` from the primary OLTP Postgres instance entirely to free up CPU.
2. **Event-Driven Auto-Scaling:** Configure AWS Application Auto Scaling to spawn ECS worker tasks based on SQS queue depth (`ApproximateNumberOfMessagesVisible`).
3. **LLM Rate Limit Management:** Implement intelligent token bucket rate-limiting. Fallback to secondary LLM providers (e.g., Anthropic, Azure OpenAI) if primary provider hits 429 errors.
4. **Websocket Fleet:** Move real-time notification responsibilities to a horizontally scaled Redis Pub/Sub + Node/Socket.io fleet.

## Phase 3: 100,000 Concurrent Users (Market Leader)

### Bottlenecks & Saturation Points
- **Monolithic Database Limits:** Vertical scaling of the single Postgres instance (even to an `db.r6g.16xlarge`) will hit I/O and memory limits.
- **Global Latency:** Users in different geographic regions will experience high latency hitting a single region database.

### Remediation
1. **Database Sharding / Partitioning:** 
   - Move to a multi-tenant sharding strategy (e.g., Citus Data or application-level routing).
   - Shard by `organization_id`. Large enterprise tenants get their own dedicated database shards.
2. **Multi-Region Active-Active:** 
   - Deploy compute clusters in US, EU, and APAC.
   - Use Global Accelerator for routing.
   - Replicate core identity and routing metadata globally, while keeping tenant data localized to their region for compliance (Data Residency).
3. **Advanced Caching Layer:** Implement a comprehensive Redis caching tier for user sessions, RBAC permission trees, and frequent DB queries, reducing primary DB hits by 80%.