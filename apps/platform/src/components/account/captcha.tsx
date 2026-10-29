"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile (docs/owner-steps.md, Accounts). Supabase checks the token; the widget is
// usually invisible and asks for a click only when it doubts. Without a site key (development,
// tests: NEXT_PUBLIC_CAPTCHA_MODE=simulated) nothing is shown and no token is sent.

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const captchaSiteKey = (): string | null =>
  process.env.NEXT_PUBLIC_CAPTCHA_MODE === "simulated"
    ? null
    : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null);

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.append(script);
  });
  return loading;
}

/** The widget; `resetKey` changes after each attempt, since a token works only once. */
export function Captcha({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | undefined) => void;
  resetKey?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const siteKey = captchaSiteKey();
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey renders a fresh widget after each attempt
  useEffect(() => {
    if (!siteKey || !box.current) return;
    let widget: string | undefined;
    let cancelled = false;
    onTokenRef.current(undefined);
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: "pt-br",
          theme: "light",
          size: "flexible",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(undefined),
          "error-callback": () => onTokenRef.current(undefined),
        });
      })
      .catch(() => onTokenRef.current(undefined));
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, resetKey]);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
