"use client";

import { formSteps12, missingToGenerate } from "@brotasites/schema/v1.2";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StepFooter } from "@/components/wizard/step-footer";
import { StepHeader } from "@/components/wizard/step-header";
import { useForm12 } from "@/lib/form-store";
import { infoFor } from "@/lib/site-status";
import { requestDirections, SiteActionError, saveDraft } from "@/lib/sites";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { LockedNote } from "./step-form";

// Step 6: the client sends the answers and may close the page. The 3 directions show up on
// "Meus sites" when they are ready; redoing them is unlimited until one is approved.

export function DirectionStep() {
  const router = useRouter();
  const { draft, completed, site, siteId, completeStep, identityLocked } = useForm12();
  const missing = missingToGenerate(draft);
  const status = site?.status ?? "draft";
  const canSend =
    !identityLocked && ["draft", "needs_attention", "awaiting_direction_choice"].includes(status);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const supabase = getBrowserSupabase();
    if (!supabase || missing.length > 0 || !canSend) return;
    setSending(true);
    setError(null);
    try {
      // The saved draft is what the job reads: save it now instead of waiting for the autosave.
      const steps = completed.includes("direcao") ? completed : [...completed, "direcao" as const];
      await saveDraft(supabase, siteId, draft, steps);
      await requestDirections(supabase, siteId);
      completeStep("direcao");
      router.push(`/meus-sites/${siteId}`);
    } catch (caught) {
      setError(
        caught instanceof SiteActionError
          ? caught.message
          : "Não foi possível enviar agora. Tente de novo em instantes.",
      );
      setSending(false);
    }
  }

  const action = canSend ? (
    <Button
      type="submit"
      size="lg"
      disabled={sending || missing.length > 0}
      className="group ml-auto flex-1 sm:flex-none"
    >
      {sending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          Enviando…
        </>
      ) : (
        <>
          {status === "awaiting_direction_choice" ? "Criar outras 3 direções" : "Ver as 3 direções"}
          <ArrowRight
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </>
      )}
    </Button>
  ) : (
    <Button asChild size="lg" className="ml-auto flex-1 sm:flex-none">
      <Link href={`/meus-sites/${siteId}`}>Acompanhar em Meus sites</Link>
    </Button>
  );

  return (
    <form
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <StepHeader step="direcao" />
      <div className="grid gap-6">
        {identityLocked ? (
          <LockedNote>
            Você já aprovou uma direção. A identidade do site fica como está; mudanças de conteúdo,
            fotos e contato entram quando você pedir para montar o site de novo, em “Meus sites”.
          </LockedNote>
        ) : !canSend ? (
          <LockedNote>{infoFor(status).text}</LockedNote>
        ) : missing.length > 0 ? (
          <div className="grid gap-3 rounded-lg border border-pollen/60 bg-pollen/10 p-4">
            <p className="font-semibold">Falta pouco. Para criar as direções, precisamos de:</p>
            <ul className="grid list-disc gap-1.5 pl-5 text-[0.9375rem]">
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm text-ink-soft">
              Volte para{" "}
              {formSteps12.slice(0, 5).map((step, index) => (
                <span key={step.slug}>
                  {index > 0 && (index === 4 ? " ou " : ", ")}
                  <Link
                    href={`/criar/${siteId}/${step.slug}`}
                    className="font-semibold text-leaf-deep underline underline-offset-4"
                  >
                    {step.title.toLocaleLowerCase("pt-BR")}
                  </Link>
                </span>
              ))}
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-4 text-[0.9375rem]">
            <p>
              A gente cria 3 caminhos para o visual do seu site: <strong>Fiel à marca</strong>,{" "}
              <strong>Evolução</strong> e <strong>Contraste</strong>. Você escolhe um, ou pede
              outros 3, quantas vezes quiser.
            </p>
            <p className="text-ink-soft">
              Leva alguns minutos. Pode fechar a página: quando ficarem prontas, as direções
              aparecem em “Meus sites”.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
      <StepFooter step="direcao" action={action} />
    </form>
  );
}
