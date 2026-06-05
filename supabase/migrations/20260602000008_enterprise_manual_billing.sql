-- Enterprise Manual Billing Infrastructure
-- This migration adds support for non-automated, manually invoiced subscriptions.

-- 1. Ensure provider_id exists and relax provider_id constraint for manual enterprise accounts
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_id text;
ALTER TABLE public.subscriptions ALTER COLUMN IF EXISTS provider_id DROP NOT NULL;

-- 2. Add billing metadata to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS is_manual_billing BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ;

-- 3. Enterprise Invoices Table
CREATE TABLE IF NOT EXISTS public.enterprise_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount_inr INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, overdue, void
    due_date DATE,
    paid_at TIMESTAMPTZ,
    invoice_number TEXT UNIQUE,
    pdf_url TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enterprise invoices"
    ON public.enterprise_invoices FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. Function to manually provision Enterprise
CREATE OR REPLACE FUNCTION public.provision_enterprise_plan(
    _user_id UUID,
    _duration_months INTEGER DEFAULT 12
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub_id UUID;
BEGIN
    -- Check if admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Only admins can manually provision Enterprise plans';
    END IF;

    -- Upsert subscription
    INSERT INTO public.subscriptions (
        user_id,
        plan,
        status,
        credits_remaining,
        is_manual_billing,
        current_period_end
    )
    VALUES (
        _user_id,
        'enterprise',
        'active',
        999999,
        true,
        now() + (_duration_months || ' months')::interval
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        credits_remaining = EXCLUDED.credits_remaining,
        is_manual_billing = true,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now()
    RETURNING id INTO v_sub_id;

    RETURN v_sub_id;
END;
$$;
