# Security Audit & Fixes for Weybre

## Critical Security Issues Found

### 1. ❌ EXPOSED SECRETS IN .env FILE
**Severity: CRITICAL**
- `.env` file contains real API keys and should NEVER be committed
- `GOOGLE_AI_API_KEY="e2b6178d-b2c5-4f8e-ba3b-7e652b0502cc"` is exposed in `.env.example`
- **Fix**: Remove from `.env.example`, add to `.gitignore`, rotate the key immediately

### 2. ❌ WEAK PASSWORD IN CONNECTION STRING
**Severity: CRITICAL**
- Database password `Weybre@2025` is predictable and exposed
- **Fix**: Use strong random passwords, store in environment variables only

### 3. ⚠️ CORS MISCONFIGURATION
**Severity: HIGH**
- `create-dodo-checkout/index.ts` allows localhost origins in production
- **Fix**: Remove localhost from ALLOWED_ORIGINS in production deployments

### 4. ⚠️ MISSING RATE LIMITING
**Severity: HIGH**
- No rate limiting on expensive AI operations
- **Fix**: Implement rate limiting per user/IP for all edge functions

### 5. ⚠️ INSUFFICIENT INPUT VALIDATION
**Severity: MEDIUM**
- Edge functions don't validate input sizes
- **Fix**: Add max length checks for all user inputs

### 6. ⚠️ MISSING CREDIT CHECKS
**Severity: HIGH**
- Edge functions don't check credits before expensive operations
- **Fix**: Call `deduct_credits()` BEFORE processing, not after

### 7. ✅ GOOD: SQL Injection Protection
- All SQL uses parameterized queries
- No dynamic SQL concatenation found

### 8. ✅ GOOD: Authentication
- Proper JWT validation via Supabase Auth
- PKCE flow enabled for OAuth

### 9. ✅ GOOD: RLS Policies
- Row Level Security enabled on all tables
- Proper user isolation

## Pricing Model Implementation Status

### ✅ SQL Migration Ready
- `20260523000000_new_pricing_model.sql` is complete
- Adds: starter, professional, firm, enterprise tiers
- Implements credit system with atomic deduction
- Adds credit_transactions audit log

### ⚠️ Frontend Needs Update
- Pricing page already updated with new prices
- Need to update checkout flow to handle new plans

### ⚠️ Edge Functions Need Credit Integration
- All AI functions must call `deduct_credits()` before processing
- Functions to update:
  - `research/index.ts`
  - `draft/index.ts`
  - `contract-intake/index.ts`
  - `decision-engine/index.ts`
  - `litigation-intel/index.ts`

## Action Items

### Immediate (Do Now)
1. ✅ Remove secrets from `.env.example`
2. ✅ Add `.env` to `.gitignore` (already done)
3. ⚠️ Rotate exposed Google AI API key
4. ⚠️ Change database password
5. ✅ Apply new pricing migration

### Short Term (This Week)
1. Add credit checks to all AI edge functions
2. Implement rate limiting middleware
3. Add input validation middleware
4. Remove localhost from production CORS
5. Add monitoring/alerting for credit abuse

### Medium Term (This Month)
1. Implement credit overage billing
2. Add credit usage analytics dashboard
3. Implement automatic credit reset cron job
4. Add webhook retry logic with exponential backoff
5. Implement proper error tracking (Sentry)

## New Pricing Model Summary

| Plan | Price (INR) | Seats | Credits | Target |
|------|-------------|-------|---------|--------|
| Starter | ₹1,999/mo | 1 | 100 | Solo lawyers |
| Professional | ₹4,999/mo | 1 | 500 | Practicing lawyers |
| Firm | ₹14,999/mo | 5 | 2,000 | Small firms |
| Enterprise | Custom | Unlimited | Unlimited | Large firms |

### Credit Costs
- Research query: 1 credit
- Draft generation: 1 credit
- Litigation brief: 2 credits
- Decision engine: 2 credits
- Contract analysis: 3 credits

### Revenue Projections
- 50 Starter + 20 Professional + 5 Firm + 1 Enterprise = ₹3.75L/month (~$4,500)
- Target: ₹45L ARR in 3 months
- Path to $100K/month: 20 Enterprise deals or 1,700 Professional seats (12-18 months)
