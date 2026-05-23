import { ReactNode, useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard, Receipt, ArrowLeft, FileEdit, Newspaper, Menu,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/admin/payments", label: "Payments", icon: Receipt },
  { to: "/admin/pages", label: "Pages", icon: FileEdit },
  { to: "/admin/posts", label: "Posts", icon: Newspaper },
];

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="flex items-center justify-between border-b border-border p-4 lg:p-5">
        <Logo />
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider text-accent">
          Admin
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            navigate("/app");
            onNavigate?.();
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Button>
      </div>
    </>
  );
}

export const AdminShell = ({ children, title }: { children: ReactNode; title: string }) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-border lg:bg-card">
        <AdminSidebar />
      </aside>

      <main className="flex min-h-screen min-w-0 flex-col">
        <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open admin menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(100vw-2rem,280px)] flex-col p-0">
              <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 flex-1 truncate font-serif text-lg font-semibold">{title}</h1>
        </div>

        <header className="sticky top-14 z-30 hidden border-b border-border bg-background/85 px-6 py-4 backdrop-blur-md lg:top-0 lg:flex lg:h-16 lg:items-center lg:px-8">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        </header>

        <div className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};
