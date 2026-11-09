import { cn } from "@/lib/utils";

// Skeletons (E26): the shape of the next page while its data arrives, the same size as the
// content that replaces it (no jump), from the colour tokens, with a very soft sheen that stops
// with reduced motion. Shown only when the wait passes about 120ms (".skeleton-screen" in
// globals.css), so fast pages never flicker. Never text that looks like real content: screen
// readers hear "Carregando…" once.

/** One grey block. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-block rounded-lg", className)} />;
}

/** The waiting screen: a live status said once, and the blocks. */
export function SkeletonScreen({
  children,
  className,
  label = "Carregando…",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={cn("skeleton-screen", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A labeled field: the label's line and the 52px input (44px on short screens). */
export function SkeletonField({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-13 w-full [@media(max-height:700px)]:h-11" />
    </div>
  );
}

/** A title and its supporting line. */
export function SkeletonHeading({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      <Skeleton className="h-10 w-3/5 [@media(max-height:700px)]:h-8" />
      <Skeleton className="h-5 w-4/5" />
    </div>
  );
}

/** A site's card on "Meus sites": name and badge, sentence, button, details. */
export function SkeletonSiteCard() {
  return (
    <div className="grid gap-4 rounded-xl border border-input bg-card p-5 sm:p-6">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <Skeleton className="h-5 w-2/3" />
      </div>
      <Skeleton className="h-12 w-44 rounded-full" />
      <div className="grid gap-3 border-t border-line pt-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
