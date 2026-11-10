import Link from "next/link";
import { Brand } from "@/components/brand";
import { CONTACT_EMAIL } from "@/content/contact";
import { LinkPending } from "./link-pending";
import { footerLinks } from "./nav";

/**
 * The one footer of every page (E17). Only what the header does not offer (E29): the Terms,
 * the Privacy Policy and the contact address. The account screens have none (E30).
 */
export function SiteFooter() {
  const list = (
    <ul className="flex flex-wrap gap-x-7 gap-y-6 text-[0.9375rem]">
      {footerLinks.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="touch-target text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            {link.label}
            <LinkPending />
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-3">
          <Brand />
          <p className="max-w-[28ch] text-[0.9375rem] text-ink-soft">
            5 passos e seu site pronto. Responda, escolha entre 3 visuais e publique.
          </p>
          {/* One quiet line with the only contact channel (E28): an email, no form. */}
          {CONTACT_EMAIL && (
            <p className="text-[0.9375rem] text-ink-soft">
              Fale com a gente:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="touch-target text-leaf-deep underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          )}
        </div>
        <nav aria-label="Rodapé">{list}</nav>
      </div>
    </footer>
  );
}
