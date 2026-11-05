import { MorningLight } from "@/components/site/morning-light";
import { cn } from "@/lib/utils";

// The frame of the sign-in, sign-up and password pages: one card centered under the header.
// Sign-in and sign-up are the same page with a different card (owner's decision, 2026-11-05):
// both carry the morning light, which sits behind the card, never over its text.
export function AuthShell({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <main
      className={cn(
        "grid min-h-[calc(100dvh-4rem)] place-items-center bg-paper px-4 py-10 sm:px-5 sm:py-12",
        light && "relative isolate overflow-hidden",
      )}
    >
      {light && <MorningLight />}
      <div
        data-auth-card
        className={cn(
          "step-enter relative w-full max-w-[28rem] rounded-2xl border border-line bg-card p-6 sm:p-9",
          "shadow-[0_1px_0_rgb(255_255_255/0.9)_inset,0_30px_60px_-40px_rgb(20_36_27/0.45)]",
        )}
      >
        {children}
      </div>
    </main>
  );
}
