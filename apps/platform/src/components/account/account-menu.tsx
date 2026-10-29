import Link from "next/link";
import { memberLinks } from "@/components/site/nav";
import { SignOutButton } from "@/components/site/sign-out";

// Each item is a full 44px target, apart from its neighbours, also when the menu wraps on phones.
const linkClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center px-1 font-semibold text-leaf-deep underline-offset-4 hover:underline aria-[current=page]:text-ink aria-[current=page]:underline";

/**
 * The signed-in pages' menu: Painel, Criar site, Perfil e segurança, Sair (the same links as
 * the public header shows to signed-in people). `current` marks the page it is on.
 */
export function AccountMenu({ current, extra }: { current?: string; extra?: React.ReactNode }) {
  return (
    <nav
      aria-label="Conta"
      className="flex flex-wrap items-center justify-end gap-x-3 text-[0.8125rem]"
    >
      {extra}
      {memberLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={current === link.href ? "page" : undefined}
          className={linkClass}
        >
          {link.label}
        </Link>
      ))}
      <SignOutButton className={linkClass} />
    </nav>
  );
}
