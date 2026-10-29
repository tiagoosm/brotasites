import Link from "next/link";
import { Brand } from "@/components/brand";
import { footerLinks, guestLinks, memberLinks } from "./nav";

export function SiteFooter({ signedIn }: { signedIn: boolean }) {
  const links = [...footerLinks, ...(signedIn ? memberLinks.slice(0, 1) : guestLinks.slice(0, 1))];
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-3">
          <Brand />
          <p className="max-w-[28ch] text-[0.9375rem] text-ink-soft">
            Sete perguntas e seu site pronto.
          </p>
        </div>
        <nav aria-label="Rodapé">
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
        </nav>
      </div>
    </footer>
  );
}
