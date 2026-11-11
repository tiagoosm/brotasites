import { connection } from "next/server";
import { Brand } from "@/components/brand";
import { SkipLink } from "@/components/site/skip-link";

// The team's own screens (E33): the sign-in of admin.brotasites.com.br. A frame of its own,
// nothing of the clients' site: the brand and the "Área da equipe" tag, no public links, no
// "Entrar"/"Criar conta", no phone menu, no footer, no light, no vine, no sparks. Rendered on
// each request, so its scripts carry the request's CSP nonce (src/proxy.ts).
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <div className="min-h-dvh bg-ink text-paper">
      <SkipLink />
      <header className="border-b border-paper/15">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Brand href="/admin" prefetch={false} className="text-paper" />
          <span className="tag rounded-full border border-paper/30 px-3 py-1 text-paper">
            Área da equipe
          </span>
        </div>
      </header>
      <div id="conteudo" tabIndex={-1} className="outline-none">
        {children}
      </div>
    </div>
  );
}
