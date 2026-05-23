import { forwardRef } from "react";
import { Sparkles, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { className?: string; variant?: "subtle" | "warning"; }

export const AiDisclaimer = forwardRef<HTMLDivElement, Props>(({ className, variant = "subtle" }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
      variant === "subtle"
        ? "border-accent/30 bg-accent-soft text-primary"
        : "border-warning/40 bg-warning/10 text-warning",
      className,
    )}
    role="note"
    aria-label="AI generated content disclaimer"
  >
    {variant === "subtle" ? <Sparkles className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
    <span className="font-medium">AI-generated · Verify before filing</span>
  </div>
));

AiDisclaimer.displayName = "AiDisclaimer";
