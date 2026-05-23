import { forwardRef, ReactNode, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FileText, FolderOpen, Settings as SettingsIcon, LogOut, Search, ShieldCheck,
  LayoutDashboard, Sparkles, Gavel, Inbox, Building2, ChevronsUpDown, Check, KeyRound,
  ScrollText, Menu,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOrganizations } from "@/hooks/useOrganizations";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const NAV = [
  { to: "/app/research", label: "Research", icon: Search },
  { to: "/app/decide", label: "Decision Engine", icon: Sparkles },
  { to: "/app/litigation", label: "Litigation Intel", icon: Gavel },
  { to: "/app/intake", label: "Contract Intake", icon: Inbox },
  { to: "/app/matters", label: "Matters", icon: FolderOpen },
  { to: "/app/drafts", label: "Drafts", icon: FileText },
  { to: "/app/organizations", label: "Organizations", icon: Building2 },
  { to: "/app/organizations/sso", label: "SSO", icon: KeyRound },
  { to: "/app/organizations/audit", label: "Activity audit", icon: ScrollText },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function SidebarPanel({
  onNavigate,
  userEmail,
  signOut,
  sub,
  isUnlimited,
  creditsRemaining,
  creditsPercent,
  isAdmin,
  orgs,
  currentOrg,
  setCurrentOrgId,
}: {
  onNavigate?: () => void;
  userEmail?: string | null;
  signOut: () => Promise<void>;
  sub: ReturnType<typeof useSubscription>["sub"];
  isUnlimited: boolean;
  creditsRemaining: number;
  creditsPercent: number;
  isAdmin: boolean;
  orgs: ReturnType<typeof useOrganizations>["orgs"];
  currentOrg: ReturnType<typeof useOrganizations>["currentOrg"];
  setCurrentOrgId: (id: string) => void;
}) {
  const navigate = useNavigate();

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <>
      <div className="border-b border-sidebar-border p-4 lg:p-5">
        <Link to="/app" onClick={onNavigate}>
          <Logo variant="light" />
        </Link>
      </div>

      {orgs.length > 0 && (
        <div className="border-b border-sidebar-border px-3 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 rounded-md bg-sidebar-accent/40 px-3 py-2 text-left text-sm hover:bg-sidebar-accent">
                <div className="min-w-0">
                  <div className="truncate font-medium">{currentOrg?.name ?? "Select organization"}</div>
                  {currentOrg && (
                    <div className="truncate text-xs capitalize text-sidebar-foreground/60">{currentOrg.role}</div>
                  )}
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {orgs.map((o) => (
                <DropdownMenuItem key={o.id} onClick={() => { setCurrentOrgId(o.id); onNavigate?.(); }}>
                  <Check className={cn("mr-2 h-4 w-4", currentOrg?.id === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => go("/app/organizations")}>
                <Building2 className="mr-2 h-4 w-4" />
                Manage organizations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "mt-4 flex items-center gap-3 rounded-md border-t border-sidebar-border px-3 py-2.5 pt-4 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )
            }
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 rounded-md bg-sidebar-accent/60 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-sidebar-primary">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize">{sub?.plan ?? "No plan"}</span>
            </div>
            <span className="font-mono text-[0.65rem] text-sidebar-foreground/60">
              {isUnlimited ? "∞ credits" : `${creditsRemaining} cr left`}
            </span>
          </div>
          {!isUnlimited && sub?.status === "active" && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-sidebar-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  creditsPercent > 20 ? "bg-accent" : "bg-destructive",
                )}
                style={{ width: `${Math.max(2, creditsPercent)}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{userEmail}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut().then(() => go("/"))}
            className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export const AppShell = forwardRef<HTMLDivElement, { children: ReactNode; title?: string; action?: ReactNode }>(
  ({ children, title, action }, ref) => {
    const { user, signOut } = useAuth();
    const { sub, loading, isActive, isUnlimited, creditsRemaining, creditsPercent } = useSubscription();
    const { isAdmin } = useIsAdmin();
    const { orgs, currentOrg, setCurrentOrgId } = useOrganizations();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading || isAdmin) return;
    const exempt = ["/pricing", "/onboarding"].includes(location.pathname);
    if (!isActive && !exempt) {
      navigate("/pricing", { replace: true });
    }
  }, [loading, sub, isActive, isAdmin, location.pathname, navigate]);

    useEffect(() => {
      setMobileOpen(false);
    }, [location.pathname]);

    const sidebarProps = {
      userEmail: user?.email,
      signOut,
      sub,
      isUnlimited,
      creditsRemaining,
      creditsPercent,
      isAdmin,
      orgs,
      currentOrg,
      setCurrentOrgId,
    };

    return (
      <div ref={ref} className="min-h-screen bg-hero lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar lg:text-sidebar-foreground">
          <SidebarPanel {...sidebarProps} />
        </aside>

        <main className="flex min-h-screen min-w-0 flex-col">
          <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[min(100vw-2rem,280px)] flex-col border-r bg-sidebar p-0 text-sidebar-foreground">
                <SidebarPanel {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            {title ? (
              <h1 className="min-w-0 flex-1 truncate font-serif text-lg font-semibold text-primary">{title}</h1>
            ) : (
              <Link to="/app" className="min-w-0 flex-1">
                <Logo />
              </Link>
            )}
          </div>

          {(title || action) && (
            <header className="sticky top-14 z-30 flex flex-col gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:top-0 lg:h-16 lg:flex-row lg:py-0 lg:px-8">
              {title && (
                <h1 className="hidden min-w-0 truncate font-serif text-xl font-semibold tracking-tight text-primary sm:block lg:text-2xl">
                  {title}
                </h1>
              )}
              {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
            </header>
          )}

          <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
        </main>
      </div>
    );
  },
);

AppShell.displayName = "AppShell";
