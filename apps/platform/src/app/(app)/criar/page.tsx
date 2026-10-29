import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/shared/page-state";
import { StartForm } from "./start-form";

export const metadata: Metadata = {
  title: "Criar meu site",
};

export default function CreatePage() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-paper px-5">
      <Suspense fallback={<Loading />}>
        <StartForm />
      </Suspense>
    </main>
  );
}
