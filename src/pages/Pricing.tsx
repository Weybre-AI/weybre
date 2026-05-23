import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Check, IndianRupee, Loader2, ShieldCheck, Zap, Building2, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeFunction } from "@/lib/invokeFunction";
import { safeCheckoutUrl } from "@/lib/safeRedirect";
import { useState } from "react";
import { Seo } from "@/components/Seo";
import { MarketingNav } from "@/components/MarketingNav";
import { Badge } from "@/components/ui/badge";

type PlanKey = "starter" | "professional" | "firm";

const PLANS = [
  {
    key: "starter" as PlanKey,
    name: "Starter",
    price: "1,999",
    period: "/lawyer / month",
    credits: "100 AI credits",
    seats: "1 seat",
    highlight: false,
    badge: null,
    icon: IndianRupee,
    features: [
      "100 AI credits / month",
      "Case-law research (1 credit/query)",
      "Contract drafting (1 credit/draft)",
      "Matter management",
      "Export PDF & DOCX",
      "GST-compliant invoices",
      "Email support",
    ],
    cta: "Start with Starter",
  },
  {
    key: "professional" as PlanKey,
    name: "Professional",
    price: "4,999",
    period: "/lawyer / month",
    credits: "500 AI credits",
    seats: "1 seat",
    highlight: true,
    badge: "Most popular",
    icon: Zap,
    features: [
      "500 AI credits / month",
      "Everything in Starter",
      "Litigation Intel + eCourts tracking",
      "Contract intake & analysis (3 credits)",
      "Decision engine (2 credits)",
      "Audit log",
      "Priority support",
      "SSO ready",
    ],
    cta: "Start with Professional",
  },
  {
    key: "firm" as PlanKey,
    name: "Firm",
    price: "14,999",
    period: "/month · up to 5 seats",
    credits: "2,000 pooled credits",
    seats: "Up to 5 seats",
    highlight: false,
    badge: "Best value",
    icon: Building2,
    features: [
      "2,000 pooled AI credits / month",
      "Up to 5 lawyer seats",
      "Everything in Professional",
      "Shared matters & research",
      "Org-level audit trail",
      "Dedicated onboarding call",
      "SLA support",
    ],
    cta: "Start with Firm",
  },
] as const;

const CREDIT_COSTS = [
  { action: "Research query", credits: 1 },
  { action: "Draft generation", credits: 1 },
  { action: "Litigation brief", credits: 2 },
  { action: "Decision engine", credits: 2 },
  { action: "Contract analysis", credits: 3 },
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const startCheckout = async (plan: PlanKey) => {
    if (!user) { navigate("/auth?mode=signup"); return; }
    setLoading(plan);
    try {
      const { data, error } = await invokeFunction<{ checkout_url?: string }>("create-dodo-checkout", {
        body: { plan, origin: window.location.origin },
      });
      if (error) throw error;
      const checkoutUrl = safeCheckoutUrl(data?.checkout_url);
      if (!checkoutUrl) throw new Error("Invalid checkout URL from payment provider");
      window.location.href = checkoutUrl;
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to start checkout");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-hero">
      <Seo
        title="Pricing — Weybre AI for Indian Lawyers"
        description="Transparent pricing for Indian advocates and firms. Starter ₹1,999/mo, Professional ₹4,999/mo, Firm ₹14,999/mo. AI credits included. GST invoices."
        path="/pricing"
      />
      <MarketingNav logoClassName="text-xl font-serif tracking-tight text-primary sm:text-2xl" />

      <main className="container max-w-6xl px-4 py-8 sm:py-10">
        <p className="text-center font-mono text-xs uppercase tracking-wider text-accent">Transparent pricing</p>
        <h1 className="mt-2 text-center font-serif text-3xl font-semibold text-primary md:text-4xl">
          Pay for what you use
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Every plan includes AI credits. Credits reset monthly. No hidden fees.
        </p>

        {/* Credit cost reference */}
        <div className="mx-auto mt-6 flex flex-wrap justify-center gap-3">
          {CREDIT_COSTS.map(c => (
            <span key={c.action} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="font-semibold text-accent">{c.credits}cr</span>
              {c.action}
            </span>
          ))}
        </div>

        {/* Plan cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map(plan => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-xl border p-7 ${
                plan.highlight
                  ? "border-accent/50 shadow-glow bg-card"
                  : "border-border bg-card"
              }`}
            >
              {plan.badge && (
                <span className={`absolute -top-3 left-7 rounded-full px-3 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider ${
                  plan.highlight ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
                }`}>
                  {plan.badge}
                </span>
              )}

              <div className="flex items-center gap-2">
                <plan.icon className="h-4 w-4 text-accent" />
                <h2 className="font-serif text-xl font-semibold text-primary">{plan.name}</h2>
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-serif text-4xl font-semibold text-primary">₹{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{plan.credits}</Badge>
                <Badge variant="outline" className="text-xs">{plan.seats}</Badge>
              </div>

              <Button
                onClick={() => startCheckout(plan.key)}
                disabled={loading === plan.key}
                className="mt-5 w-full"
                variant={plan.highlight ? "default" : "outline"}
              >
                {loading === plan.key
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ShieldCheck className="h-4 w-4" />}
                {plan.cta}
              </Button>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.features.map((f: string) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
          <Building2 className="mx-auto mb-3 h-6 w-6 text-accent" />
          <h3 className="font-serif text-xl font-semibold text-primary">Enterprise</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Unlimited seats · Unlimited credits · API access · Custom integrations · Dedicated account manager
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button variant="default" onClick={() => window.location.href = "mailto:sales@weybre.com?subject=Enterprise enquiry"}>
              <Phone className="h-4 w-4" /> Contact sales
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "mailto:sales@weybre.com?subject=Enterprise enquiry"}>
              Request a demo
            </Button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prices in INR · GST extra · Secure checkout via Dodo Payments · Cancel anytime in Settings
        </p>
      </main>
    </div>
  );
};

export default Pricing;
