"use client";

import {
  DESCRIPTION_GOOD,
  DESCRIPTION_SHORT,
  familyOf,
  writingTips,
} from "@brotasites/schema/v1.2";
import { Tip } from "@/components/shared/tip";

// Live, gentle help under "Conte em poucas palavras o que você faz" (E41): an example of a thin
// and a detailed answer for the client's kind of business, then, as they type, two guiding
// questions while the text is short and a thank-you once it is long. Never blocks, never scores.

export function DescriptionCoach({
  category,
  description,
}: {
  category: string | undefined;
  description: string | undefined;
}) {
  const tip = writingTips[familyOf(category) ?? "food"];
  const length = (description ?? "").trim().length;
  return (
    <Tip className="-mt-2">
      <p>
        Quanto mais você escrever, melhor fica o seu site. Conte o que você vende, o que os clientes
        mais elogiam e como o negócio começou.
      </p>
      <details className="group">
        <summary className="touch-target cursor-pointer font-semibold text-leaf-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf">
          Ver um exemplo
        </summary>
        <dl className="mt-1 grid gap-2">
          <div>
            <dt className="font-semibold">Pouco:</dt>
            <dd>“{tip.weak}”</dd>
          </div>
          <div>
            <dt className="font-semibold">Melhor:</dt>
            <dd>“{tip.good}”</dd>
          </div>
        </dl>
      </details>
      <p aria-live="polite" className="text-ink">
        {length > 0 && length < DESCRIPTION_SHORT
          ? `Dá para contar um pouco mais: ${tip.questions[0]} ${tip.questions[1]}`
          : length >= DESCRIPTION_GOOD
            ? "Isso ajuda muito."
            : ""}
      </p>
    </Tip>
  );
}
