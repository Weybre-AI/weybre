import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Plans" },
  { to: "/auth", label: "Sign in" },
];

type MarketingNavProps = {
  logoClassName?: string;
  cta?: React.ReactNode;
};

export function MarketingNav({ logoClassName = "text-3xl tracking-tight text-foreground", cta }: MarketingNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative z-10 mx-auto flex max-w-7xl flex-row items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
      <Link to="/" className={logoClassName} style={{ fontFamily: "'Instrument Serif', serif" }}>
        Weybre<sup className="text-xs"> AI</sup>
      </Link>

      <div className="hidden items-center gap-6 md:flex">
        {LINKS.map((l) =>
          l.to ? (
            <Link key={l.label} to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ) : (
            <a key={l.label} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </a>
          ),
        )}
      </div>

      <div className="flex items-center gap-2">
        {cta ?? (
          <Link
            to="/auth?mode=signup"
            className="liquid-glass hidden rounded-full px-4 py-2 text-sm text-foreground hover:scale-[1.03] sm:inline-flex sm:px-6 sm:py-2.5"
          >
            Get started
          </Link>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100vw-2rem,320px)]">
            <SheetHeader>
              <SheetTitle className="font-serif text-left">Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-3">
              {LINKS.map((l) =>
                l.to ? (
                  <Link
                    key={l.label}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="text-base font-medium"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="text-base font-medium">
                    {l.label}
                  </a>
                ),
              )}
              <Link
                to="/auth?mode=signup"
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex rounded-full bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
              >
                Get started
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
