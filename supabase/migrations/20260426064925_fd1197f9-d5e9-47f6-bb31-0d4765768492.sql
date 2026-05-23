ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS razorpay_order_id text,
ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
ADD COLUMN IF NOT EXISTS checkout_status text NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_payment_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid,
  provider text NOT NULL DEFAULT 'razorpay',
  event_type text NOT NULL,
  provider_event_id text,
  amount integer,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_events_select_own ON public.billing_events;
CREATE POLICY billing_events_select_own
ON public.billing_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS billing_events_admin_all ON public.billing_events;
CREATE POLICY billing_events_admin_all
ON public.billing_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON public.billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_provider_event_id ON public.billing_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order_id ON public.subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment_id ON public.subscriptions(razorpay_payment_id);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();