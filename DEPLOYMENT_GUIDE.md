# Deployment Guide - New Pricing Model

## Step 1: Apply Database Migration

### Option A: Using Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/ruhkbhbuqydrniwxwujt/sql/new
2. Copy the entire contents of `supabase/migrations/20260523000000_new_pricing_model.sql`
3. Paste into the SQL Editor
4. Click "Run" to execute
5. Verify success - you should see "Success. No rows returned"

### Option B: Using Supabase CLI
```bash
# Make sure you're linked to the project
supabase link --project-ref ruhkbhbuqydrniwxwujt

# Push only the new migration
supabase db push
```

### Verification
Run this query in the SQL Editor to verify the migration worked:
```sql
SELECT id, display_name, price_inr, seats, credits_month 
FROM public.billing_plans 
ORDER BY sort_order;
```

You should see 4 rows: starter, professional, firm, enterprise

## Step 2: Update Environment Variables

### Supabase Edge Functions Secrets
Go to: https://supabase.com/dashboard/project/ruhkbhbuqydrniwxwujt/settings/functions

Add these secrets (if not already set):
```bash
DODO_PRODUCT_ID_STARTER=<your_dodo_starter_product_id>
DODO_PRODUCT_ID_PROFESSIONAL=<your_dodo_professional_product_id>
DODO_PRODUCT_ID_FIRM=<your_dodo_firm_product_id>
```

### CRITICAL: Rotate Exposed Secrets
The following secrets were exposed in the repository and MUST be rotated immediately:

1. **Google AI API Key**: `e2b6178d-b2c5-4f8e-ba3b-7e652b0502cc`
   - Go to https://aistudio.google.com/apikey
   - Delete the old key
   - Create a new key
   - Update in Supabase: Dashboard → Edge Functions → Secrets → GOOGLE_AI_API_KEY

2. **Database Password**: `Weybre@2025`
   - Go to Supabase Dashboard → Settings → Database
   - Reset the database password
   - Update all connection strings

## Step 3: Deploy Updated Edge Functions

```bash
# Deploy all updated functions with credit checks
supabase functions deploy research
supabase functions deploy draft
supabase functions deploy contract-intake
supabase functions deploy decision-engine
supabase functions deploy litigation-intel
```

## Step 4: Update Dodo Payments Products

### Create New Products in Dodo Dashboard
1. Go to your Dodo Payments dashboard
2. Create 3 new subscription products:

**Starter Plan**
- Name: Weybre Starter
- Price: ₹1,999/month
- Billing: Monthly recurring
- Copy the Product ID and set as `DODO_PRODUCT_ID_STARTER`

**Professional Plan**
- Name: Weybre Professional
- Price: ₹4,999/month
- Billing: Monthly recurring
- Copy the Product ID and set as `DODO_PRODUCT_ID_PROFESSIONAL`

**Firm Plan**
- Name: Weybre Firm
- Price: ₹14,999/month
- Billing: Monthly recurring
- Copy the Product ID and set as `DODO_PRODUCT_ID_FIRM`

## Step 5: Test the New Pricing

### Test Credit System
1. Create a test user account
2. Manually set their subscription to 'active' with credits:
```sql
UPDATE public.subscriptions 
SET status = 'active', 
    plan = 'starter', 
    credits_remaining = 100,
    credits_reset_at = now() + interval '1 month'
WHERE user_id = '<test_user_id>';
```

3. Make a research query and verify:
   - Credits are deducted
   - Transaction is logged in `credit_transactions`
   - Response includes `credits_remaining`

### Test Checkout Flow
1. Go to /pricing page
2. Click "Start with Starter"
3. Verify redirect to Dodo Payments
4. Complete test payment
5. Verify webhook updates subscription status

## Step 6: Monitor & Alert

### Set up monitoring for:
1. Failed credit deductions (users hitting limits)
2. Failed webhook deliveries
3. Unusual credit usage patterns
4. API rate limit hits

### Recommended: Add Sentry or similar
```bash
# Add to edge functions
SENTRY_DSN=<your_sentry_dsn>
```

## Step 7: Migrate Existing Users

### For existing 'solo' and 'firm' users:
```sql
-- Migrate solo users to starter
UPDATE public.subscriptions 
SET plan = 'starter',
    credits_remaining = 100,
    credits_reset_at = now() + interval '1 month'
WHERE plan = 'solo' AND status = 'active';

-- Migrate firm users to professional (or firm based on seats)
UPDATE public.subscriptions 
SET plan = 'professional',
    credits_remaining = 500,
    credits_reset_at = now() + interval '1 month'
WHERE plan = 'firm' AND status = 'active' AND seats_used <= 1;

UPDATE public.subscriptions 
SET plan = 'firm',
    credits_remaining = 2000,
    credits_reset_at = now() + interval '1 month'
WHERE plan = 'firm' AND status = 'active' AND seats_used > 1;
```

## Step 8: Set Up Monthly Credit Reset

### Create a Supabase Edge Function Cron Job
1. Go to Dashboard → Database → Cron Jobs
2. Create new job:
```sql
-- Run daily at 00:00 UTC to reset credits for users whose reset date has passed
SELECT cron.schedule(
  'reset-monthly-credits',
  '0 0 * * *',
  $$
  SELECT public.reset_monthly_credits(user_id)
  FROM public.subscriptions
  WHERE status = 'active'
    AND credits_reset_at IS NOT NULL
    AND credits_reset_at <= now();
  $$
);
```

## Rollback Plan

If something goes wrong:

```sql
-- Rollback: Restore old billing_plans
DROP TABLE IF EXISTS public.billing_plans CASCADE;
-- Then re-run the old migration from 20260426065059

-- Rollback: Remove credit columns
ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS credits_remaining,
  DROP COLUMN IF EXISTS credits_reset_at,
  DROP COLUMN IF EXISTS seats_used,
  DROP COLUMN IF EXISTS dodo_customer_id,
  DROP COLUMN IF EXISTS dodo_payment_id;

-- Rollback: Drop credit tables
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.credit_costs CASCADE;
DROP FUNCTION IF EXISTS public.deduct_credits(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.reset_monthly_credits(uuid);
```

## Post-Deployment Checklist

- [ ] Migration applied successfully
- [ ] All 4 plans visible in billing_plans table
- [ ] Dodo product IDs configured
- [ ] Edge functions deployed
- [ ] Test user can make requests and credits deduct
- [ ] Checkout flow works end-to-end
- [ ] Webhook updates subscription correctly
- [ ] Exposed secrets rotated
- [ ] Monitoring/alerting configured
- [ ] Existing users migrated
- [ ] Cron job for credit reset configured
- [ ] Documentation updated
- [ ] Team notified of new pricing

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs → Edge Functions
2. Check database logs: Dashboard → Logs → Database
3. Verify RLS policies are working
4. Test with `--debug` flag on CLI commands
