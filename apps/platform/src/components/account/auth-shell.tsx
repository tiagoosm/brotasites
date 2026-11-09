import { MorningLight } from "@/components/site/morning-light";
import { cn } from "@/lib/utils";

// The frame of the sign-in, sign-up and password pages: one card centered under the header.
// Sign-in and sign-up are the same page with a different card (owner's decision, 2026-11-05):
// both carry the morning light, behind the card, never over its text.
//
// It fits (E26): on laptops and larger, the header, the card and the compact footer fit the
// screen with no scroll; on short screens and phones the card is never cut and the page simply
// scrolls. So nothing here hides overflow (only the light's own layer does), the minimum height
// leaves room for the header (64px and its 1px line) and the compact footer (--auth-footer), and
// below 700px of height the spacing, the gaps, the fields (to 44px, still a full tap target) and
// the title shrink.
export function AuthShell({
  children,
  light = false,
  wide = false,
}: {
  children: React.ReactNode;
  light?: boolean;
  /** The sign-up card: two columns from 768px. */
  wide?: boolean;
}) {
  return (
    <main
      className={cn(
        "relative isolate grid min-h-[calc(100dvh-4rem-1px-var(--auth-footer))] place-items-center bg-paper px-4 py-8 sm:px-5",
        "[@media(max-height:700px)]:py-4",
      )}
    >
      {light && <MorningLight />}
      <div
        data-auth-card
        className={cn(
          "step-enter relative w-full rounded-2xl border border-line bg-card p-6 sm:p-8",
          "shadow-[0_1px_0_rgb(255_255_255/0.9)_inset,0_30px_60px_-40px_rgb(20_36_27/0.45)]",
          wide ? "max-w-[28rem] md:max-w-[40rem]" : "max-w-[28rem]",
          // Short screens: a tighter card, closer fields and a smaller title.
          "[@media(max-height:700px)]:sm:px-7 [@media(max-height:700px)]:py-4",
          "[@media(max-height:700px)]:[&_form]:gap-3 [@media(max-height:700px)]:[&_h1]:text-[2rem]",
          "[@media(max-height:700px)]:[&_header]:gap-1.5 [@media(max-height:700px)]:[&_label]:-mb-0.5",
          "[@media(max-height:700px)]:[&_input:not([type=checkbox])]:h-11",
        )}
      >
        {children}
      </div>
    </main>
  );
}
