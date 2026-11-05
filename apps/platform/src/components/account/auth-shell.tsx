import { MorningLight } from "@/components/site/morning-light";
import { cn } from "@/lib/utils";

// The frame of the sign-in, sign-up and password pages: one quiet column under the header.
// The sign-in page carries the morning light behind it (moved from the home page, 2026-11-05).
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
        "grid min-h-[calc(100dvh-4rem)] place-items-center bg-paper px-5 py-12",
        light && "relative isolate overflow-hidden",
      )}
    >
      {light && <MorningLight />}
      <div className="step-enter w-full max-w-[26rem]">{children}</div>
    </main>
  );
}
