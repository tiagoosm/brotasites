/** "Pular para o conteúdo", the first thing on every page. */
export function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
    >
      Pular para o conteúdo
    </a>
  );
}
