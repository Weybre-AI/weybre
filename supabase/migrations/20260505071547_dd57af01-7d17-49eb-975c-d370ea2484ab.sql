ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dodo_subscription_id text,
  ADD COLUMN IF NOT EXISTS dodo_payment_id text,
  ADD COLUMN IF NOT EXISTS dodo_customer_id text,
  ADD COLUMN IF NOT EXISTS dodo_checkout_session_id text;

CREATE INDEX IF NOT EXISTS subscriptions_dodo_subscription_id_idx
  ON public.subscriptions(dodo_subscription_id);

UPDATE public.billing_plans SET active = false WHERE provider = 'razorpay';