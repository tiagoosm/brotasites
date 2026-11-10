import { MorningLight } from "@/components/site/morning-light";
import { cn } from "@/lib/utils";

// The frame of the sign-in, sign-up and password pages: one card centered under the header.
// Sign-in and sign-up are the same page with a different card (owner's decision, 2026-11-05):
// both carry the morning light, behind the card, never over its text.
//
// It fits (E26): on laptops and larger, the header and the card fit the screen with no scroll;
// on short screens and phones the card is never cut and the page simply scrolls. Nothing here
// hides overflow (only the light's own layer does). No footer since E30: the minimum height
// leaves room for the header only (64px and its 1px line), the card is centred in the rest and
// never closer than 24px to the header (16px for the small cards on short screens). Below 700px of
// height every card eases its padding, gaps and fields a little, so each fits with no scroll.
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
        "relative isolate grid min-h-[calc(100dvh-4rem-1px)] place-items-center bg-paper px-4 py-6 sm:px-5",
        // Short screens: small cards may come within 16px of the header; sign-up keeps 24px
        // above and gives up the space under it.
        wide ? "[@media(max-height:700px)]:pb-0" : "[@media(max-height:700px)]:py-4",
      )}
    >
      {light && <MorningLight />}
      <div
        data-auth-card
        className={cn(
          "step-enter relative w-full rounded-2xl border border-line bg-card px-6 py-8 sm:px-9 sm:py-9",
          "shadow-[0_1px_0_rgb(255_255_255/0.9)_inset,0_30px_60px_-40px_rgb(20_36_27/0.45)]",
          wide ? "max-w-[28rem] md:max-w-[40rem]" : "max-w-[28rem]",
          // Short screens (below 700px of height): a little less padding and gap, 44px fields
          // (still a full tap target), so every account card fits 1366×650 and 1280×600 with no
          // scroll (E30). Taller screens keep the full breathing room of E27.
          "[@media(max-height:700px)]:py-7 [@media(max-height:700px)]:[&_form]:gap-5",
          "[@media(max-height:700px)]:[&_input:not([type=checkbox])]:h-11",
          wide && [
            "[@media(max-height:700px)]:[&_form>div]:gap-y-4",
            "[@media(max-height:640px)]:py-6",
          ],
        )}
      >
        {children}
      </div>
    </main>
  );
}
