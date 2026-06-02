import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";

const redirectBase = import.meta.env.PROD ? "https://weybre.com" : window.location.origin;

const Auth = () => {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const redirect = safeRedirectPath(
      params.get("redirect") ?? (location.state as { from?: string } | null)?.from,
      "/onboarding",
    );
    navigate(redirect, { replace: true });
  }, [user, navigate, params, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${redirectBase}/onboarding` },
        });
        if (error) throw error;
        toast.success("Welcome to Weybre AI", { description: "Let's get your workspace set up." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${redirectBase}/onboarding` },
    });
    if (error) { toast.error(error.message); setLoading(false); }
  };



  const handleSso = async () => {
    const domain = email.split("@")[1]?.toLowerCase().trim();
    if (!domain) { toast.error("Enter your work email first"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("org_sso_for_domain", { _domain: domain });
      if (error) throw error;
      const cfg = Array.isArray(data) ? data[0] : data;
      if (!cfg) { toast.error("No SSO configured for " + domain); return; }
      if (cfg.provider === "google" || cfg.provider === "google_workspace") {
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${redirectBase}/onboarding`,
            queryParams: { hd: cfg.email_domain, prompt: "select_account" },
          },
        });
        if (oauthErr) throw oauthErr;
      } else if (cfg.provider === "saml") {
        const { error: ssoErr } = await supabase.auth.signInWithSSO({
          domain: cfg.email_domain,
          options: { redirectTo: `${redirectBase}/onboarding` },
        });
        if (ssoErr) throw ssoErr;
      } else {
        toast.error("Unsupported SSO provider: " + cfg.provider);
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? "SSO sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/"><Logo /></Link>
          <h1 className="mt-10 font-serif text-3xl font-semibold tracking-tight text-primary">
            {mode === "signup" ? "Open your Weybre AI workspace" : "Welcome back, Counsel"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup" ? "Card required at next step. Subscribe to get started." : "Sign in to your research workspace."}
          </p>

          <Button onClick={handleGoogle} variant="outline" className="mt-8 w-full" disabled={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/></svg>
            Continue with Google
          </Button>

          <Button onClick={handleSso} variant="outline" className="mt-2 w-full" disabled={loading}>
            <Lock className="h-4 w-4" />
            Sign in with Enterprise SSO
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Adv. Priya Sharma" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@chamber.in" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" className="pl-9" />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary-glow" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New to Weybre AI? "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-medium text-accent hover:underline">
              {mode === "signup" ? "Sign in" : "Create account"}
            </button>
          </p>
          <p className="mt-8 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
            By continuing, you confirm you are a licensed legal professional and agree that Weybre AI outputs are AI-generated and must be independently verified.
          </p>
        </div>
      </div>

      <div className="relative hidden bg-gradient-primary p-12 lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, hsl(var(--accent)) 0, transparent 50%)" }} />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">A note from our founders</p>
          <blockquote className="mt-4 max-w-md font-serif text-2xl leading-snug text-primary-foreground">
            "Lawyers shouldn't compete with technology. They should be amplified by it. Weybre AI is the co-counsel we wished we had at 11 PM on a Friday."
          </blockquote>
          <p className="mt-4 text-sm text-primary-foreground/80">— The Weybre AI team, Bengaluru</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
