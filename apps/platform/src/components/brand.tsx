import Link from "next/link";

/** The BrotaSites mark: a sprout and the name. Links to the home page. */
export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 font-display text-[1.375rem] leading-none ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-leaf">
        <path d="M12 22V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z" fill="currentColor" />
        <path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" fill="currentColor" opacity=".65" />
      </svg>
      BrotaSites
    </Link>
  );
}
