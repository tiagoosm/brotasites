"use client";

import { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Inside a <Link> (E26): while its navigation is pending, the link says so (aria-busy, so the
 * cursor shows progress, globals.css) and a small dot pulses beside it. Placed absolutely, so
 * nothing moves. The link needs `relative` (touch-target links already have it).
 */
export function LinkPending({ dot = true }: { dot?: boolean }) {
  const { pending } = useLinkStatus();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const link = ref.current?.closest("a");
    if (!link) return;
    if (pending) link.setAttribute("aria-busy", "true");
    else link.removeAttribute("aria-busy");
  }, [pending]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-pending={pending || undefined}
      hidden={!dot}
      className="link-pending pointer-events-none absolute top-1/2 -right-3 size-1.5 -translate-y-1/2 rounded-full bg-current opacity-0"
    />
  );
}

/**
 * Prefetch by intent (E26): the account pages are not prefetched from the public pages
 * (prefetch={false}, so visitors never download the account code in advance), but the moment
 * the pointer reaches a link, it gets focus or a finger touches it, the next page starts
 * loading, and the click lands on a warm page.
 */
export function useIntentPrefetch(href: string) {
  const router = useRouter();
  const done = useRef(false);
  const prefetch = () => {
    if (done.current) return;
    done.current = true;
    router.prefetch(href);
  };
  return { onPointerEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
}
