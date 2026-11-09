import Link from "next/link";
import { Skeleton, SkeletonHeading, SkeletonScreen } from "@/components/ui/skeleton";

// The few states an account page shows before its content: loading, unavailable, not found.

/**
 * While a page checks the session or reads its data (E26): the shape of a page (a title and
 * blocks) rather than a spinner, shown only after about 120ms. A specific label ("Abrindo o seu
 * site…") is also said in text.
 */
export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <SkeletonScreen label={label} className="grid min-h-[50dvh] content-start gap-6 py-2">
      <SkeletonHeading />
      {label !== "Carregando…" && (
        <p aria-hidden="true" className="text-[0.9375rem] text-ink-soft">
          {label}
        </p>
      )}
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </SkeletonScreen>
  );
}

export function Notice({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto grid max-w-md gap-3 py-16 text-center">
      <h1 className="font-display text-[1.75rem] leading-tight">{title}</h1>
      <p className="text-[0.9375rem] text-ink-soft">{text}</p>
      {action && (
        <Link
          href={action.href}
          className="touch-target justify-self-center font-semibold text-leaf-deep underline underline-offset-4"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export const unavailable = {
  title: "Indisponível no momento",
  text: "A criação de sites não está disponível agora. Tente de novo mais tarde.",
};
