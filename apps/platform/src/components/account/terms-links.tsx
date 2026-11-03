import Link from "next/link";

/**
 * The terms and the privacy policy, opened in a new tab, under the "Li e aceito" box. They sit
 * on their own line, apart, so each keeps a 44px tap area (Fitts) instead of two small links
 * inside the label's sentence.
 */
export function TermsLinks() {
  return (
    <p className="flex flex-wrap gap-x-6 gap-y-6 pl-9 text-[0.9375rem]">
      <Link
        href="/termos"
        target="_blank"
        className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
      >
        Termos de uso
      </Link>
      <Link
        href="/privacidade"
        target="_blank"
        className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
      >
        Política de Privacidade
      </Link>
    </p>
  );
}
