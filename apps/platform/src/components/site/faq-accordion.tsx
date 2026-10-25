"use client";

import { Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { Faq } from "@/content/faq";

/**
 * Questions as an accessible accordion (disclosure pattern): each question is a heading
 * holding a button with aria-expanded and aria-controls, and the answer is the panel it
 * opens. Each answer has its own address (/ajuda#quanto-custa) and opens when the page is
 * reached through it.
 */
export function FaqAccordion({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    const openFromHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      if (!items.some((item) => item.slug === slug)) return;
      setOpen((current) => new Set(current).add(slug));
      requestAnimationFrame(() =>
        document.getElementById(slug)?.scrollIntoView({ block: "start" }),
      );
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [items]);

  const toggle = (slug: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });

  return (
    <div className="border-t border-line">
      {items.map((item) => (
        <FaqItem
          key={item.slug}
          item={item}
          expanded={open.has(item.slug)}
          onToggle={() => toggle(item.slug)}
        />
      ))}
    </div>
  );
}

function FaqItem({
  item,
  expanded,
  onToggle,
}: {
  item: Faq;
  expanded: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const buttonId = useId();
  return (
    <div id={item.slug} className="scroll-mt-24 border-b border-line">
      <h3 className="font-sans text-[1.0625rem] font-semibold tracking-normal">
        <button
          type="button"
          id={buttonId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full cursor-pointer items-start justify-between gap-6 rounded-sm py-5 text-left text-ink"
        >
          {item.question}
          <Plus
            aria-hidden="true"
            className={`mt-1 size-5 shrink-0 text-stem transition-transform duration-200 ease-[var(--ease-out)] ${expanded ? "rotate-45" : ""}`}
          />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded}>
        <p className="max-w-[62ch] pb-6 text-ink-soft">{item.answer}</p>
      </div>
    </div>
  );
}
