"use client";

import { type FormStepSlug, formSteps } from "@brotasites/schema";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useOpenPreview } from "./wizard-shell";

/** Back link and the button that validates the step and names where it goes next. */
export function StepFooter({
  step,
  action,
}: {
  step: FormStepSlug;
  /** Replaces the next-step button (the last question publishes instead). */
  action?: React.ReactNode;
}) {
  const openPreview = useOpenPreview();
  const index = formSteps.findIndex((s) => s.slug === step);
  const previous = formSteps[index - 1];
  const next = formSteps[index + 1];
  const label = next ? `Próximo: ${next.title.toLocaleLowerCase("pt-BR")}` : "Revisar e publicar";

  return (
    <div className="sticky bottom-0 z-10 mt-auto -mx-5 flex items-center gap-3 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:-mx-10 sm:px-10 lg:static lg:mx-0 lg:mt-auto lg:border-0 lg:bg-transparent lg:px-0 lg:py-10 lg:backdrop-blur-none">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        onClick={openPreview}
        aria-label="Ver prévia"
        className="size-12 rounded-full border-leaf bg-leaf-wash text-leaf-deep lg:hidden"
      >
        <Eye aria-hidden="true" className="size-5" />
      </Button>
      {previous && (
        <Button asChild variant="ghost" className="hidden h-12 px-4 text-ink-soft sm:inline-flex">
          <Link href={`/criar/${previous.slug}`}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Link>
        </Button>
      )}
      {action ?? (
        <Button type="submit" size="lg" className="group ml-auto flex-1 sm:flex-none">
          {label}
          <ArrowRight
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Button>
      )}
    </div>
  );
}
