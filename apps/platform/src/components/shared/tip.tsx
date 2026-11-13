import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

// A quiet tip (E41): an icon and a short text, never in the way. Used where a little more from
// the client makes the site much better (the description, the story, the photos).

export function Tip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 text-sm text-ink-soft", className)}>
      <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-stem" />
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}
