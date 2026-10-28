import { LoaderCircle } from "lucide-react";
import Link from "next/link";

// The few states an account page shows before its content: loading, unavailable, not found.

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-[50dvh] place-items-center text-ink-soft">
      <span className="inline-flex items-center gap-2">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-leaf" />
        {label}
      </span>
    </div>
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
          className="font-semibold text-leaf-deep underline underline-offset-4"
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
