"use client";

import { formatPhone } from "@brotasites/schema";
import {
  categoryInfo,
  type FormStepSlug12,
  formSteps12,
  sectionsOf,
} from "@brotasites/schema/v1.2";
import Link from "next/link";
import { useForm12 } from "@/lib/form-store";

const sectionNames: Record<string, string> = {
  sobre: "Sobre",
  servicos: "Serviços",
  "como-funciona": "Como funciona",
  diferenciais: "Diferenciais",
  galeria: "Galeria",
  depoimentos: "Depoimentos",
  faq: "Perguntas frequentes",
  "cta-final": "Chamada final",
  contato: "Contato",
};

/**
 * The answers of the 5 steps in a few lines, each with a way back to its step (Murphy, Miller):
 * before sending them (the last step) and before approving (Publicar).
 */
export function AnswersSummary({ only }: { only?: readonly FormStepSlug12[] } = {}) {
  const { draft, siteId } = useForm12();
  const business = draft.business ?? {};
  const contact = draft.contact ?? {};
  const content = draft.content ?? {};
  const channels = [
    contact.whatsapp && `WhatsApp ${formatPhone(contact.whatsapp)}`,
    contact.phone && `Telefone ${formatPhone(contact.phone)}`,
    contact.email,
  ].filter(Boolean);
  const services = (content.services ?? []).filter((s) => s.name?.trim()).length;
  const photos = (content.photos ?? []).length;
  const rows: [FormStepSlug12, string][] = [
    [
      "negocio",
      [
        business.name,
        business.category && categoryInfo(business.category)?.label,
        [business.city, business.state].filter(Boolean).join(" - "),
      ]
        .filter(Boolean)
        .join(" · ") || "Ainda sem respostas",
    ],
    [
      "marca",
      [
        draft.brand?.logoAsset ? "Com logo" : "Sem logo (monograma)",
        draft.brand?.feelings?.length ? draft.brand.feelings.join(" e ") : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      "secoes",
      sectionsOf(draft)
        .map((id) => sectionNames[id] ?? id)
        .join(", "),
    ],
    [
      "conteudo",
      `${services} ${services === 1 ? "serviço" : "serviços"} · ${photos} ${photos === 1 ? "foto" : "fotos"}`,
    ],
    ["contato", channels.join(" · ") || "Nenhum canal ainda"],
  ];
  return (
    <dl className="grid gap-3">
      {rows
        .filter(([slug]) => !only || only.includes(slug))
        .map(([slug, text]) => (
          <div key={slug} className="grid gap-1 border-b border-border pb-3 last:border-0">
            <dt className="flex items-baseline justify-between gap-3">
              <span className="tag text-stem">
                {formSteps12.find((s) => s.slug === slug)?.title}
              </span>
              <Link
                href={`/criar/${siteId}/${slug}`}
                className="touch-target text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
              >
                Mudar
              </Link>
            </dt>
            <dd className="text-[0.9375rem]">{text}</dd>
          </div>
        ))}
    </dl>
  );
}
