import Link from "next/link";
import { Brand } from "@/components/brand";
import { footerLinks, memberLinks, signInLink } from "./nav";

/**
 * The one footer of every page (E17). `compact` is the quiet single line of the focus screens
 * (sign in, sign up, password).
 */
export function SiteFooter({
  signedIn,
  compact = false,
}: {
  signedIn: boolean;
  compact?: boolean;
}) {
  const links = [...footerLinks, signedIn ? memberLinks[0] : signInLink].filter(
    (link) => link !== undefined,
  );
  const list = (
    <ul className="flex flex-wrap gap-x-7 gap-y-6 text-[0.9375rem]">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            prefetch={link.account ? false : undefined}
            className="touch-target text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
  if (compact) {
    return (
      <footer className="border-t border-line bg-paper">
        <nav
          aria-label="Rodapé"
          className="mx-auto flex max-w-6xl justify-center px-5 py-6 sm:px-8"
        >
          {list}
        </nav>
      </footer>
    );
  }
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-3">
          <Brand />
          <p className="max-w-[28ch] text-[0.9375rem] text-ink-soft">
            Sete perguntas e seu site pronto.
          </p>
        </div>
        <nav aria-label="Rodapé">{list}</nav>
      </div>
    </footer>
  );
}
