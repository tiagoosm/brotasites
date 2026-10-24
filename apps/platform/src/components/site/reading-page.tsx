import { ChevronDown } from "lucide-react";

// Long reading pages (help, terms, privacy): a narrow column, with a table of contents that
// stays beside the text on wide screens and folds into "Nesta página" on phones.

export interface TocEntry {
  id: string;
  label: string;
}

export function ReadingPage({
  eyebrow,
  title,
  intro,
  toc,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  toc: TocEntry[];
  children: React.ReactNode;
}) {
  const links = (
    <ol className="grid gap-2.5 text-[0.9375rem]">
      {toc.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            {entry.label}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 pt-14 pb-28 sm:px-8 sm:pt-20 lg:grid-cols-[14rem_minmax(0,42rem)] lg:gap-20">
      <header className="grid gap-4 lg:col-start-2">
        <p className="tag text-stem">{eyebrow}</p>
        <h1 className="font-display text-[2.75rem] leading-[1.04] sm:text-[3.5rem]">{title}</h1>
        <div className="text-[1.125rem] text-ink-soft">{intro}</div>
      </header>

      <nav aria-label="Nesta página" className="lg:row-span-2 lg:row-start-1">
        <details className="group rounded-xl border border-line bg-card px-4 py-3 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
            Nesta página
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="pt-4 pb-1">{links}</div>
        </details>
        <div className="sticky top-24 hidden lg:block">
          <p className="tag mb-4 text-stem">Nesta página</p>
          {links}
        </div>
      </nav>

      <div className="grid gap-16 lg:col-start-2">{children}</div>
    </div>
  );
}

/** A titled part of a reading page, reachable from the table of contents. */
export function ReadingSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="grid scroll-mt-24 gap-5">
      <h2
        id={`${id}-titulo`}
        className="font-display text-[1.875rem] leading-tight sm:text-[2.125rem]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
