import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
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
