import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
};
