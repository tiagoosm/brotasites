"use client";

import {
  type FormStepSlug12 as FormStepSlug,
  formSteps12 as formSteps,
} from "@brotasites/schema/v1.2";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useForm12 } from "@/lib/form-store";

/** Back link and the button that validates the step and names where it goes next. */
export function StepFooter({
  step,
  action,
}: {
  step: FormStepSlug;
  /** Replaces the next-step button (sending the answers, approving the site). */
  action?: React.ReactNode;
}) {
  const { siteId } = useForm12();
  const index = formSteps.findIndex((s) => s.slug === step);
  const previous = formSteps[index - 1];
  const next = formSteps[index + 1];
  const label = next ? `Próximo: ${next.title.toLocaleLowerCase("pt-BR")}` : "Concluir";

  return (
    <div className="sticky bottom-0 z-10 mt-auto -mx-5 flex items-center gap-3 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:-mx-10 sm:px-10 lg:static lg:mx-0 lg:mt-auto lg:border-0 lg:bg-transparent lg:px-0 lg:py-10 lg:backdrop-blur-none">
      {previous && (
        <Button asChild variant="ghost" className="h-12 px-4 text-ink-soft">
          <Link href={`/criar/${siteId}/${previous.slug}`}>
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
