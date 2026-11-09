"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { EmailConfirmBanner } from "@/components/account/email-banner";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { PublishPhase } from "@/components/steps/publish-phase";
import { useRequiredAccount } from "@/lib/account";
import { FormProvider, useForm12 } from "@/lib/form-store";

// "Publicar" (E25): the address, the finished site and the approval, after the 5 steps and the
// choice of a direction. It was step 7 of the former form (/criar/<site>/endereco redirects
// here). It decides by the site's status, never by the form's progress.

const READY = [
  "awaiting_approval",
  "publishing",
  "live",
  "grace",
  "suspended",
  "in_review",
  "building",
];

export default function PublishPage() {
  const { site } = useParams<{ site: string }>();
  const account = useRequiredAccount();
  useEffect(() => {
    document.title = "Publicar · BrotaSites";
  }, []);
  if (account.status === "unavailable") return <Notice {...unavailable} />;
  if (account.status !== "signed-in") return <Loading />;
  return (
    <FormProvider siteId={site} account={{ userId: account.userId, email: account.email }}>
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[44rem] flex-col px-5 pt-10 pb-12 sm:px-10 sm:pt-14">
        <EmailConfirmBanner account={account} />
        <Publish />
      </main>
    </FormProvider>
  );
}

function Publish() {
  const { ready, missing, site, siteId } = useForm12();
  if (!ready) return <Loading />;
  if (missing || !site) {
    return (
      <Notice
        title="Site não encontrado"
        text="Este site não está na sua conta. Confira se entrou com o mesmo e-mail."
        action={{ href: "/meus-sites", label: "Ir para Meus sites" }}
      />
    );
  }
  // Before a direction is chosen there is nothing to publish yet: the site's page says what
  // comes first (answering the 5 steps, or choosing one of the 3 directions).
  if (!site.approved_direction && !READY.includes(site.status)) {
    return (
      <div className="grid gap-4">
        <h1 className="font-display text-[2.375rem] leading-[1.06]">
          Ainda não é hora de publicar
        </h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Primeiro responda os 5 passos e escolha um dos 3 visuais.
        </p>
        <Link
          href={`/meus-sites/${siteId}`}
          className="touch-target justify-self-start font-semibold text-leaf-deep underline underline-offset-4"
        >
          Ir para a página do site
        </Link>
      </div>
    );
  }
  return <PublishPhase />;
}
