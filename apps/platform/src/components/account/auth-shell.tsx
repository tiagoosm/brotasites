import { Brand } from "@/components/brand";

// The frame of the sign-in, sign-up and password pages: the mark, then one column.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5 py-12">
      <div className="step-enter w-full max-w-[26rem]">
        <Brand className="mb-12" />
        {children}
      </div>
    </main>
  );
}
