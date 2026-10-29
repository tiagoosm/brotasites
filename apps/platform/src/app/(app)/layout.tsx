import { connection } from "next/server";

// The signed-in area and the account pages: rendered on each request, so every script carries
// the request's CSP nonce (src/proxy.ts) and nothing personal is ever prerendered or cached.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return children;
}
