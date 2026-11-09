import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      // "Painel" became "Meus sites" (E26): the list lives at /meus-sites again, with each
      // site's pages under it; the old address (bookmarks, emails) keeps working, its query too.
      { source: "/painel", destination: "/meus-sites", permanent: true },
      // Addresses of the 1.1 form (sign-in emails, bookmarks) start over at "/criar".
      {
        source: "/criar/:step(negocio|modelo|cores|secoes|conteudo|contato|endereco)",
        destination: "/criar",
        permanent: false,
      },
      // The 7-step form became 5 steps (E25): the old step 6 (sending, the 3 directions) is the
      // site's page, the old step 7 (address, approval, payment) its "Publicar" page. Both decide
      // by the site's status. "/criar/<site>/etapa/<step>" (an earlier spelling) keeps working.
      {
        source: "/criar/:site/direcao",
        destination: "/meus-sites/:site",
        permanent: true,
      },
      {
        source: "/criar/:site/endereco",
        destination: "/meus-sites/:site/publicar",
        permanent: true,
      },
      {
        source: "/criar/:site/etapa/:passo",
        destination: "/criar/:site/:passo",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
