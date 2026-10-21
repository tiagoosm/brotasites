import type * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-24 w-full min-w-0 rounded-lg border border-input bg-card px-4 py-3 text-base text-ink transition-[border-color,box-shadow] duration-150 outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-ink-soft/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
