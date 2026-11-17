import { describe, expect, it, vi } from "vitest";
import {
  type CaptchaState,
  captchaMessage,
  captchaMessages,
  createCaptchaController,
  type TurnstileApi,
} from "./captcha-controller";

// E44: the widget never fails in silence. A fake window.turnstile plays Cloudflare's part.

function fakeTurnstile() {
  const renders: Record<string, unknown>[] = [];
  const api: TurnstileApi & { renders: typeof renders; resets: number; removed: string[] } = {
    renders,
    resets: 0,
    removed: [],
    render: (_element, options) => {
      renders.push(options);
      return `w${renders.length}`;
    },
    reset: () => {
      api.resets += 1;
    },
    remove: (id) => {
      api.removed.push(id);
    },
  };
  return api;
}

function setup(load: () => Promise<TurnstileApi | undefined>) {
  const states: CaptchaState[] = [];
  const timers: { run: () => void; ms: number }[] = [];
  const warn = vi.fn();
  const controller = createCaptchaController({
    siteKey: "0xAAAAAAAAAAAAAAAAAAAAAA",
    element: {} as HTMLElement,
    load,
    onChange: (state) => states.push(state),
    setTimer: (run, ms) => {
      timers.push({ run, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
    warn,
  });
  const last = () => states.at(-1) as CaptchaState;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { controller, states, timers, warn, last, flush };
}

const callback = (options: Record<string, unknown>, name: string) =>
  options[name] as (...args: unknown[]) => void;

describe("the Turnstile widget (E44)", () => {
  it("renders invisible first and is ready once the token arrives", async () => {
    const api = fakeTurnstile();
    const { controller, last, flush } = setup(async () => api);
    controller.start();
    expect(last().status).toBe("loading");
    await flush();
    expect(api.renders[0]?.appearance).toBe("interaction-only");
    expect(api.renders[0]?.language).toBe("pt-br");
    callback(api.renders[0] as Record<string, unknown>, "callback")("token-1");
    expect(last()).toMatchObject({ status: "ready", token: "token-1" });
  });

  it("when the script does not load, says so and offers to try again", async () => {
    let fail = true;
    const api = fakeTurnstile();
    const { controller, last, flush, warn } = setup(async () => {
      if (fail) throw new Error("blocked");
      return api;
    });
    controller.start();
    await flush();
    expect(last()).toMatchObject({ status: "error", errorCode: "script" });
    expect(last().message).toBe(captchaMessages.blocked);
    expect(warn).toHaveBeenCalledWith("[turnstile]", "script");

    fail = false;
    controller.retry();
    await flush();
    // Tried again, now visible.
    expect(api.renders[0]?.appearance).toBe("always");
    expect(last().status).toBe("loading");
  });

  it("treats a missing window.turnstile after loading as a failed script", async () => {
    const { controller, last, flush } = setup(async () => undefined);
    controller.start();
    await flush();
    expect(last()).toMatchObject({ status: "error", errorCode: "script" });
  });

  it("an error-callback keeps the code for the console and shows a generic sentence", async () => {
    const api = fakeTurnstile();
    const { controller, last, flush, warn } = setup(async () => api);
    controller.start();
    await flush();
    callback(api.renders[0] as Record<string, unknown>, "error-callback")("110200");
    expect(last()).toMatchObject({ status: "error", errorCode: "110200" });
    // A domain that is not authorized is the team's problem: the person reads no jargon.
    expect(last().message).toBe(captchaMessages.generic);
    expect(warn).toHaveBeenCalledWith("[turnstile]", "110200");

    controller.retry();
    await flush();
    expect(api.removed).toContain("w1");
    expect(api.renders[1]?.appearance).toBe("always");
  });

  it("shows the widget when no token came in time", async () => {
    const api = fakeTurnstile();
    const { controller, last, flush, timers } = setup(async () => api);
    controller.start();
    await flush();
    expect(timers[0]?.ms).toBe(8000);
    timers[0]?.run();
    expect(api.removed).toEqual(["w1"]);
    expect(api.renders[1]?.appearance).toBe("always");
    expect(last()).toMatchObject({ status: "loading", visible: true });
  });

  it("does not show it again when the token already arrived", async () => {
    const api = fakeTurnstile();
    const { controller, flush, timers } = setup(async () => api);
    controller.start();
    await flush();
    callback(api.renders[0] as Record<string, unknown>, "callback")("token-1");
    timers[0]?.run();
    expect(api.renders).toHaveLength(1);
  });

  it("an expired token resets the widget by itself", async () => {
    const api = fakeTurnstile();
    const { controller, last, flush } = setup(async () => api);
    controller.start();
    await flush();
    const options = api.renders[0] as Record<string, unknown>;
    callback(options, "callback")("token-1");
    callback(options, "expired-callback")();
    expect(api.resets).toBe(1);
    expect(last()).toMatchObject({ status: "loading" });
    expect(last().token).toBeUndefined();
  });

  it("an interactive challenge is visible and asks for the click", async () => {
    const api = fakeTurnstile();
    const { controller, last, flush } = setup(async () => api);
    controller.start();
    await flush();
    callback(api.renders[0] as Record<string, unknown>, "before-interactive-callback")();
    expect(last()).toMatchObject({ status: "interactive", visible: true });
    expect(last().message).toBe(captchaMessages.interactive);
  });

  it("reset gives a fresh token after each attempt", async () => {
    const api = fakeTurnstile();
    const { controller, last, flush } = setup(async () => api);
    controller.start();
    await flush();
    callback(api.renders[0] as Record<string, unknown>, "callback")("token-1");
    controller.reset();
    expect(api.resets).toBe(1);
    expect(last().token).toBeUndefined();
    expect(last().status).toBe("loading");
  });

  it("ignores callbacks of a widget that was replaced", async () => {
    const api = fakeTurnstile();
    const { controller, last, flush } = setup(async () => api);
    controller.start();
    await flush();
    const old = api.renders[0] as Record<string, unknown>;
    controller.retry();
    await flush();
    callback(old, "callback")("stale");
    expect(last().token).toBeUndefined();
  });

  it("maps the documented codes to short actions", () => {
    expect(captchaMessage("200500")).toBe(captchaMessages.blocked);
    expect(captchaMessage("110100")).toBe(captchaMessages.generic);
    expect(captchaMessage("400070")).toBe(captchaMessages.generic);
    expect(captchaMessage("110620")).toBe(captchaMessages.timeout);
    expect(captchaMessage("200100")).toBe(captchaMessages.clock);
    expect(captchaMessage("300030")).toBe(captchaMessages.failed);
    expect(captchaMessage("600010")).toBe(captchaMessages.failed);
    expect(captchaMessage("unsupported")).toBe(captchaMessages.unsupported);
    expect(captchaMessage(undefined)).toBe(captchaMessages.generic);
  });
});
