import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { generationClosed, generationReady } from "@/lib/server/generation";
import { StartForm } from "./start-form";

export const metadata: Metadata = {
  title: "Criar meu site",
};

export default function CreatePage() {
  // E34: in production, no new site until generation is set up (lib/server/generation.ts).
  if (!generationReady()) {
    return (
      <main className="min-h-[calc(100dvh-4rem)] bg-paper px-5">
        <Notice
          title={generationClosed.title}
          text={generationClosed.text}
          action={{ href: "/meus-sites", label: "Ir para Meus sites" }}
        />
      </main>
    );
  }
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-paper px-5">
      <Suspense fallback={<Loading />}>
        <StartForm />
      </Suspense>
    </main>
  );
}
