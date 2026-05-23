import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizations } from "@/hooks/useOrganizations";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const { refresh, setCurrentOrgId } = useOrganizations();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/invite/${token}`)}`, { replace: true });
    }
  }, [user, authLoading, token, navigate]);

  async function accept() {
    if (!token) return;
    setStatus("working");
    const { data, error } = await (supabase as any).rpc("accept_organization_invite", { _token: token });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    await refresh();
    if (data) setCurrentOrgId(data as string);
    setStatus("ok");
    toast.success("You've joined the organization");
    setTimeout(() => navigate("/app/organizations", { replace: true }), 800);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="mb-2 font-serif text-2xl font-semibold">Join organization</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          You've been invited to collaborate. Click below to accept the invite linked to {user?.email}.
        </p>
        {status === "error" && <p className="mb-4 text-sm text-destructive">{message}</p>}
        {status === "ok" ? (
          <p className="text-sm text-muted-foreground">Joined. Redirecting…</p>
        ) : (
          <Button onClick={accept} disabled={status === "working"} className="w-full">
            {status === "working" ? "Joining…" : "Accept invite"}
          </Button>
        )}
      </Card>
    </div>
  );
}
