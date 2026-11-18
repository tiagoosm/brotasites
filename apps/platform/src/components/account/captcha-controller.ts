// The Turnstile widget's life, without React or the DOM (E44), so every failure can be tested.
// Before E44 a failure was silent: the widget is invisible ("interaction-only"), so when the
// script did not load or Cloudflare refused the site key or the domain, nothing showed and the
// form sent no token. Now every state is visible: loading, ready (token), interactive (waiting
// for a click), error (with a message and "Tentar de novo"), and a widget that gives no token in
// time is rendered again, visible.
//
// Facts from Cloudflare's documentation (repository cloudflare/cloudflare-docs, files
// turnstile/get-started/client-side-rendering/{index,widget-configurations}.mdx and
// turnstile/troubleshooting/client-side-errors/error-codes.mdx, read on 2026-11-17):
// - `appearance`: "always" (default), "execute" or "interaction-only".
// - `error-callback` receives the error code; `expired-callback` "is invoked when the token
//   expires and does not reset the widget"; `timeout-callback` when an interactive challenge
//   was not solved in time; `before-interactive-callback` / `after-interactive-callback` around
//   the interactive challenge; `unsupported-callback` for an unsupported browser.
// - Error codes: 110100 / 110110 / 400020 invalid or unknown sitekey, 110200 domain not
//   authorized ("Add current domain in Hostname Management"), 400021 sitekey domain mismatch,
//   400070 sitekey disabled, 110600 challenge timed out, 110620 interaction timed out, 200100
//   clock or cache problem, 200500 iframe load error ("Check if challenges.cloudflare.com is
//   blocked"), 300* and 600* generic challenge failure.

export type CaptchaStatus = "off" | "loading" | "ready" | "interactive" | "error";

export interface CaptchaState {
  status: CaptchaStatus;
  token?: string;
  /** Turnstile's error code, or "script" / "unsupported". Never personal data. */
  errorCode?: string;
  /** What the person reads (pt-BR), when there is something to say. */
  message?: string;
  /** Whether the widget is rendered visible ("always") instead of "interaction-only". */
  visible: boolean;
}

export interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

/** Codes that mean the widget's setup is wrong: the person gets a generic sentence. */
export const CONFIG_ERRORS = ["110100", "110110", "110200", "400020", "400021", "400070"];

export const captchaMessages = {
  blocked:
    "Não conseguimos carregar a verificação de segurança. Desative bloqueadores de anúncios para este site ou tente de novo.",
  generic: "Não foi possível confirmar a verificação. Tente de novo em instantes.",
  failed: "Não conseguimos confirmar que você não é um robô. Tente de novo.",
  timeout: "A verificação demorou demais. Tente de novo.",
  clock: "Confira se a data e a hora do seu aparelho estão certas e tente de novo.",
  unsupported:
    "Este navegador não consegue fazer a verificação de segurança. Atualize o navegador ou use outro.",
  interactive: "Marque a verificação acima para continuar.",
} as const;

/** The sentence for an error code (known codes from Cloudflare's table, above). */
export function captchaMessage(code: string | undefined): string {
  const value = String(code ?? "");
  if (value === "script" || value === "200500") return captchaMessages.blocked;
  if (value === "unsupported") return captchaMessages.unsupported;
  if (value === "200100") return captchaMessages.clock;
  if (value === "110600" || value === "110620" || value === "timeout") {
    return captchaMessages.timeout;
  }
  if (CONFIG_ERRORS.includes(value)) return captchaMessages.generic;
  if (/^[36]\d{5}$/.test(value)) return captchaMessages.failed;
  return captchaMessages.generic;
}

/** How long an invisible widget may stay without a token before it is shown (ms). */
export const VISIBLE_AFTER_MS = 8000;
/**
 * How long the visible widget may then stay silent before it counts as a failure (ms). A widget
 * of the "Invisible" type in Cloudflare is never shown, whatever the appearance: without this the
 * page waited forever on a blank space (E44b).
 */
export const GIVE_UP_AFTER_MS = 15000;

export interface ControllerDeps {
  siteKey: string;
  element: HTMLElement;
  /** Loads Cloudflare's script; resolves with window.turnstile (undefined when it is missing). */
  load: () => Promise<TurnstileApi | undefined>;
  onChange: (state: CaptchaState) => void;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  warn?: (...args: unknown[]) => void;
  visibleAfterMs?: number;
  giveUpAfterMs?: number;
}

export interface CaptchaController {
  /** Renders the widget (once the script is there). */
  start: () => void;
  /** "Tentar de novo": loads the script again if needed and renders a visible widget. */
  retry: () => void;
  /** After each attempt (a token works once) or a refusal: a fresh token. */
  reset: () => void;
  destroy: () => void;
}

export function createCaptchaController(deps: ControllerDeps): CaptchaController {
  const setTimer = deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as number));
  const warn = deps.warn ?? ((...args) => console.warn(...args));
  const waitMs = deps.visibleAfterMs ?? VISIBLE_AFTER_MS;
  const giveUpMs = deps.giveUpAfterMs ?? GIVE_UP_AFTER_MS;

  let api: TurnstileApi | undefined;
  let widget: string | undefined;
  let timer: unknown;
  let destroyed = false;
  let generation = 0;
  let state: CaptchaState = { status: "loading", visible: false };

  const set = (next: CaptchaState) => {
    state = next;
    if (!destroyed) deps.onChange(state);
  };
  const stopTimer = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };
  const removeWidget = () => {
    if (api && widget) {
      try {
        api.remove(widget);
      } catch {
        // Already gone.
      }
    }
    widget = undefined;
  };
  const fail = (code: string) => {
    stopTimer();
    warn("[turnstile]", code);
    set({
      status: "error",
      errorCode: code,
      message: captchaMessage(code),
      visible: state.visible,
    });
  };

  // No token and no click asked for in time: show the widget, so the person can act. Still
  // nothing from the visible widget after that: say so, with "Tentar de novo" (never a blank).
  const armTimer = () => {
    stopTimer();
    const mine = generation;
    const visible = state.visible;
    timer = setTimer(
      () => {
        timer = undefined;
        if (destroyed || mine !== generation || state.status !== "loading") return;
        if (visible) fail("timeout");
        else render(true);
      },
      visible ? giveUpMs : waitMs,
    );
  };

  function render(visible: boolean) {
    if (!api || destroyed) return;
    removeWidget();
    generation += 1;
    const mine = generation;
    const current = () => !destroyed && mine === generation;
    set({ status: "loading", visible });
    try {
      widget = api.render(deps.element, {
        sitekey: deps.siteKey,
        language: "pt-br",
        theme: "light",
        size: "flexible",
        appearance: visible ? "always" : "interaction-only",
        callback: (token: string) => {
          if (!current()) return;
          stopTimer();
          set({ status: "ready", token, visible: state.visible });
        },
        "error-callback": (code?: string | number) => {
          if (current()) fail(String(code ?? "unknown"));
        },
        "expired-callback": () => {
          if (!current()) return;
          // The token is no longer valid: get a fresh one by itself.
          set({ status: "loading", visible: state.visible });
          if (api && widget) api.reset(widget);
          armTimer();
        },
        "timeout-callback": () => {
          if (current())
            set({ status: "interactive", message: captchaMessages.timeout, visible: true });
        },
        "before-interactive-callback": () => {
          if (!current()) return;
          stopTimer();
          set({ status: "interactive", message: captchaMessages.interactive, visible: true });
        },
        "after-interactive-callback": () => {
          if (current() && state.status === "interactive")
            set({ status: "loading", visible: true });
        },
        "unsupported-callback": () => {
          if (current()) fail("unsupported");
        },
      });
    } catch {
      fail("render");
      return;
    }
    armTimer();
  }

  function start(visible = false) {
    stopTimer();
    set({ status: "loading", visible });
    deps
      .load()
      .then((loaded) => {
        if (destroyed) return;
        if (!loaded) {
          fail("script");
          return;
        }
        api = loaded;
        render(visible);
      })
      .catch(() => {
        if (!destroyed) fail("script");
      });
  }

  return {
    start: () => start(false),
    retry: () => {
      removeWidget();
      // Once something went wrong, the person sees the widget.
      start(true);
    },
    reset: () => {
      if (destroyed) return;
      if (state.status === "error") return;
      if (api && widget) {
        set({ status: "loading", visible: state.visible });
        try {
          api.reset(widget);
        } catch {
          render(state.visible);
          return;
        }
        armTimer();
      } else if (api) {
        render(state.visible);
      }
    },
    destroy: () => {
      destroyed = true;
      stopTimer();
      removeWidget();
    },
  };
}
