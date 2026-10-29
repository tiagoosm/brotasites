import { redirect } from "next/navigation";

// "/criar/<site>" opens the first question (old 1.1 addresses are redirected in next.config.ts).
export default async function SitePage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  redirect(`/criar/${site}/negocio`);
}
