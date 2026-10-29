import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      // The list of sites became the dashboard (E16); each site's pages keep their addresses.
      { source: "/meus-sites", destination: "/painel", permanent: true },
      // Addresses of the 1.1 form (sign-in emails, bookmarks) start over at "/criar".
      {
        source: "/criar/:step(negocio|modelo|cores|secoes|conteudo|contato|endereco)",
        destination: "/criar",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
