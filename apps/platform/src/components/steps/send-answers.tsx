"use client";

import { formSteps12, missingToGenerate } from "@brotasites/schema/v1.2";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { limits } from "@/config/limits";
import { useForm12 } from "@/lib/form-store";
import { infoFor } from "@/lib/site-status";
import { requestDirections, SiteActionError, saveDraft } from "@/lib/sites";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AnswersSummary } from "./answers-summary";
import { SectionCard } from "./fields";
import { LockedNote } from "./step-form";

// The end of the 5th step (E25): a short look at the answers, then "Enviar e ver as direções".
// Sending was step 6 of the former form. The client may close the page afterwards: the 3
// directions show up on the site's page and the dashboard (no loading screen). Redoing them
// has 2 free redos, then one per hour (E24), explained on the choice screen.

const redos = limits.freeDirectionRounds - 1;
/** The site can be sent from the form only before the directions exist, or to try again. */
const SENDABLE = ["draft", "needs_attention"];

export function useSendAnswers() {
  const router = useRouter();
  const { draft, completed, site, siteId, identityLocked } = useForm12();
  const status = site?.status ?? "draft";
  const canSend = !identityLocked && SENDABLE.includes(status);
  const missing = missingToGenerate(draft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const supabase = getBrowserSupabase();
    if (!supabase || sending) return;
    setError(null);
    const steps = completed.includes("contato") ? completed : [...completed, "contato" as const];
    if (!canSend) {
      // Already sent (or the identity is approved): save the answers and go back to the site.
      setSending(true);
      await saveDraft(supabase, siteId, draft, steps).catch(() => {});
      router.push(`/meus-sites/${siteId}`);
      return;
    }
    if (missing.length > 0) {
      setError(`Falta pouco: ${missing.join("; ")}.`);
      document.getElementById("conferir")?.scrollIntoView({ block: "start" });
      return;
    }
    setSending(true);
    try {
      // The saved draft is what the job reads: save it now instead of waiting for the autosave.
      await saveDraft(supabase, siteId, draft, steps);
      await requestDirections(siteId);
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

  return { send, sending, error, canSend, missing, status, identityLocked, siteId };
}

type Sender = ReturnType<typeof useSendAnswers>;

/** The 5th step's main button. */
export function SendButton({ sender }: { sender: Sender }) {
  return (
    <Button
      type="submit"
      size="lg"
      aria-busy={sender.sending || undefined}
      disabled={sender.sending}
      className="group ml-auto h-auto min-h-12 min-w-0 flex-1 py-2.5 whitespace-normal sm:flex-none"
    >
      {sender.sending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          {sender.canSend ? "Enviando…" : "Salvando…"}
        </>
      ) : (
        <>
          {sender.canSend ? "Enviar e ver as direções" : "Salvar e voltar ao site"}
          <ArrowRight
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </>
      )}
    </Button>
  );
}

/** "Confira antes de enviar": the answers of the 4 steps before, what is missing, what comes next. */
export function SendReview({ sender }: { sender: Sender }) {
  return (
    <div id="conferir" className="grid scroll-mt-40 gap-6">
      <SectionCard
        name="Confira antes de enviar"
        note="Toque em uma parte para mudar. Depois do envio, você pode fechar a página."
      >
        <AnswersSummary only={["negocio", "marca", "secoes", "conteudo"]} />
      </SectionCard>
      {sender.identityLocked ? (
        <LockedNote>
          Visual já aprovado. Mudanças de conteúdo entram quando você pedir uma nova versão na
          página do site.
        </LockedNote>
      ) : !sender.canSend ? (
        <LockedNote>{infoFor(sender.status).text}</LockedNote>
      ) : sender.missing.length > 0 ? (
        <div className="grid gap-3 rounded-lg border border-pollen/60 bg-pollen/10 p-4">
          <p className="font-semibold">Falta pouco. Para criar as direções, precisamos de:</p>
          <ul className="grid list-disc gap-1.5 pl-5 text-[0.9375rem]">
            {sender.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm text-ink-soft">
            Volte para{" "}
            {formSteps12.map((step, index) => (
              <span key={step.slug}>
                {index > 0 && (index === formSteps12.length - 1 ? " ou " : ", ")}
                <Link
                  href={`/criar/${sender.siteId}/${step.slug}`}
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
        <p className="text-[0.9375rem]">
          Depois do envio vêm 3 visuais: <strong>Fiel à marca</strong>, <strong>Evolução</strong> e{" "}
          <strong>Contraste</strong>. Escolha um ou peça outros 3: são {redos} refazeres grátis.
          Leva alguns minutos.
        </p>
      )}
      {sender.error && (
        <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
          {sender.error}
        </p>
      )}
    </div>
  );
}
