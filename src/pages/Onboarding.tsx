import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

const PRACTICE_AREAS = ["Litigation", "Corporate", "Criminal", "Tax", "IP", "Family", "Constitutional", "Property", "Arbitration", "Banking"];

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [barNo, setBarNo] = useState("");
  const [phone, setPhone] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data?.onboarding_completed) {
        navigate("/app", { replace: true });
        return;
      }
      if (data) {
        setFullName(data.full_name ?? "");
        setFirmName(data.firm_name ?? "");
        setBarNo(data.bar_council_number ?? "");
        setPhone(data.phone ?? "");
        setAreas(data.practice_areas ?? []);
      }
      setChecking(false);
    })();
  }, [user, navigate]);

  const toggleArea = (a: string) =>
    setAreas(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      firm_name: firmName,
      bar_council_number: barNo,
      phone,
      practice_areas: areas,
      onboarding_completed: true,
    }).eq("id", user.id);

    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success("Workspace ready");
    navigate("/pricing", { replace: true });
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero">
      <header className="container flex h-16 items-center"><Logo /></header>
      <main className="container max-w-2xl py-10">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Step 1 of 2</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-primary">Tell us about your practice</h1>
        <p className="mt-2 text-muted-foreground">This personalizes your research and helps us comply with Bar Council disclosures.</p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6 rounded-xl border border-border bg-card p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name *</Label>
              <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firm">Firm / Chamber</Label>
              <Input id="firm" value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Independent / Sharma & Associates" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bar">Bar Council number *</Label>
              <Input id="bar" value={barNo} onChange={e => setBarNo(e.target.value)} required placeholder="e.g. D/1234/2018" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91…" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Practice areas (select all that apply)</Label>
            <div className="flex flex-wrap gap-2">
              {PRACTICE_AREAS.map(a => (
                <button
                  type="button"
                  key={a}
                  onClick={() => toggleArea(a)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    areas.includes(a)
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-accent/50"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">Your details stay private to your account.</p>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary-glow">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to plans <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Onboarding;
