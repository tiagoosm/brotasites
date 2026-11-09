import { MorningLight } from "@/components/site/morning-light";
import { cn } from "@/lib/utils";

// The frame of the sign-in, sign-up and password pages: one card centered under the header.
// Sign-in and sign-up are the same page with a different card (owner's decision, 2026-11-05):
// both carry the morning light, behind the card, never over its text.
//
// It fits (E26): on laptops and larger, the header, the card and the compact footer fit the
// screen with no scroll; on short screens and phones the card is never cut and the page simply
// scrolls. So nothing here hides overflow (only the light's own layer does) and the minimum
// height leaves room for the header (64px and its 1px line) and the compact footer
// (--auth-footer). Below 700px of height the small cards ease their vertical padding, row gaps
// and fields (to 44px) a little. The sign-up card never does (owner, E27: "the card looks
// flat"): it keeps its full breathing room, and on a short laptop its "Criar conta" button is
// still in view while the page scrolls a little to the card's end.
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
        !wide && "[@media(max-height:700px)]:py-4",
      )}
    >
      {light && <MorningLight />}
      <div
        data-auth-card
        className={cn(
          "step-enter relative w-full rounded-2xl border border-line bg-card px-6 py-8 sm:px-9 sm:py-9",
          "shadow-[0_1px_0_rgb(255_255_255/0.9)_inset,0_30px_60px_-40px_rgb(20_36_27/0.45)]",
          wide ? "max-w-[28rem] md:max-w-[40rem]" : "max-w-[28rem]",
          // Short screens, small cards only (E27: room to breathe, never squashed): the same
          // padding sides, a little less on top and bottom and between rows, and 44px fields
          // (still a full tap target). The title stays 2rem everywhere.
          !wide && [
            "[@media(max-height:700px)]:py-7 [@media(max-height:700px)]:[&_form]:gap-5",
            "[@media(max-height:700px)]:[&_input:not([type=checkbox])]:h-11",
          ],
        )}
      >
        {children}
      </div>
    </main>
  );
}
