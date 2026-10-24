"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Faq } from "@/content/faq";

/**
 * Questions as native disclosure widgets. Each answer has its own address
 * (/ajuda#quanto-custa) and opens when the page is reached through it.
 */
export function FaqAccordion({ items }: { items: Faq[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id
        ? listRef.current?.querySelector<HTMLDetailsElement>(`details[id="${CSS.escape(id)}"]`)
        : null;
      if (target) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <div ref={listRef} className="border-t border-line">
      {items.map((item) => (
        <details key={item.slug} id={item.slug} className="group scroll-mt-24 border-b border-line">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[1.0625rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {item.question}
            <Plus
              aria-hidden="true"
              className="mt-1 size-5 shrink-0 text-stem transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-45"
            />
          </summary>
          <p className="max-w-[62ch] pb-6 text-ink-soft">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
