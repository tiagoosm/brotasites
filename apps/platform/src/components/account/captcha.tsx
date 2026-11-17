"use client";

import { RotateCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CaptchaController,
  type CaptchaState,
  type CaptchaStatus,
  createCaptchaController,
  type TurnstileApi,
} from "./captcha-controller";

// Cloudflare Turnstile (docs/owner-steps.md, Accounts). Supabase checks the token; the widget is
// usually invisible and asks for a click only when it doubts. Without a site key (development,
// tests: NEXT_PUBLIC_CAPTCHA_MODE=simulated; testing before launch: "off") nothing is shown and
// no token is sent.
//
// E44: it never fails in silence. Every state is visible (captcha-controller.ts): while it
// checks, the form's button says "Verificando…"; a script that did not load or an error shows a
// short sentence and "Tentar de novo"; a widget that gives no token in time is shown; an
// expired token is renewed by itself. The forms send only with a token (useCaptcha).

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const captchaSiteKey = (): string | null =>
  process.env.NEXT_PUBLIC_CAPTCHA_MODE === "simulated" ||
  process.env.NEXT_PUBLIC_CAPTCHA_MODE === "off"
    ? null
    : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null);

let loading: Promise<TurnstileApi | undefined> | null = null;
function loadScript(): Promise<TurnstileApi | undefined> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    // A failed script stays in the page: take it out before trying again.
    for (const old of document.querySelectorAll(`script[src="${SCRIPT}"]`)) old.remove();
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else {
        loading = null;
        resolve(undefined);
      }
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * The CAPTCHA state a form needs: the token, whether it may send, and a fresh token after each
 * attempt (a token works once). Spread `captcha.props` on <Captcha>.
 */
export function useCaptcha() {
  const enabled = captchaSiteKey() !== null;
  const [token, setToken] = useState<string>();
  const [status, setStatus] = useState<CaptchaStatus>(enabled ? "loading" : "off");
  const [resetKey, setResetKey] = useState(0);
  const onState = useCallback((state: CaptchaState) => {
    setToken(state.token);
    setStatus(state.status);
  }, []);
  return {
    token,
    status,
    /** True while the form must not send: no token yet, or the widget failed. */
    waiting: enabled && !token,
    /** A fresh token for the next attempt (after every submit, and after a refusal). */
    reset: () => {
      setToken(undefined);
      setResetKey((key) => key + 1);
    },
    props: { onState, resetKey },
  };
}

/** The submit button's text while the widget is not ready. */
export function captchaButtonLabel(
  captcha: { waiting: boolean; status: CaptchaStatus },
  label: string,
): string {
  return captcha.waiting && captcha.status !== "error" ? "Verificando…" : label;
}

/** The widget, with its own message and "Tentar de novo" when something goes wrong. */
export function Captcha({
  onState,
  resetKey = 0,
}: {
  onState: (state: CaptchaState) => void;
  resetKey?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const siteKey = captchaSiteKey();
  const [state, setState] = useState<CaptchaState>({ status: "loading", visible: false });
  const controller = useRef<CaptchaController | null>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    if (!siteKey || !box.current) return;
    const created = createCaptchaController({
      siteKey,
      element: box.current,
      load: loadScript,
      onChange: (next) => {
        setState(next);
        onStateRef.current(next);
      },
    });
    controller.current = created;
    created.start();
    return () => {
      created.destroy();
      controller.current = null;
    };
  }, [siteKey]);

  // After each attempt: a fresh token from the same widget (the first render needs none).
  const firstReset = useRef(resetKey);
  useEffect(() => {
    if (resetKey !== firstReset.current) controller.current?.reset();
  }, [resetKey]);

  if (!siteKey) return null;
  const failed = state.status === "error";
  return (
    // The reserved height keeps the button from jumping when the widget appears.
    <div className="grid min-h-[65px] content-start gap-2">
      <div ref={box} />
      <div aria-live="polite" className="grid gap-2">
        {state.status === "loading" && !state.visible && (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            Verificação de segurança em andamento…
          </p>
        )}
        {state.message && (
          <p
            className={failed ? "text-sm font-semibold text-destructive" : "text-sm text-ink-soft"}
          >
            {state.message}
          </p>
        )}
      </div>
      {failed && (
        <button
          type="button"
          onClick={() => controller.current?.retry()}
          className="touch-target inline-flex items-center gap-2 justify-self-start rounded font-semibold text-leaf-deep underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          <RotateCw aria-hidden="true" className="size-4 motion-safe:transition-transform" />
          Tentar de novo
        </button>
      )}
    </div>
  );
}
