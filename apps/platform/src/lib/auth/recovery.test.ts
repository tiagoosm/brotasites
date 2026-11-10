import { describe, expect, it } from "vitest";
import { allowedDuringRecovery, RECOVERY_SECONDS, recoveryState } from "./recovery";

const now = 1_800_000_000_000;
const at = (secondsAgo: number) => now / 1000 - secondsAgo;

describe("the recovery session (E30)", () => {
  it("is recognised by its own sign-in method, even without the cookie", () => {
    expect(
      recoveryState({ amr: [{ method: "recovery", timestamp: at(60) }] }, undefined, now),
    ).toBe("active");
    // A token refresh does not change how the session began.
    expect(
      recoveryState(
        {
          amr: [
            { method: "recovery", timestamp: at(120) },
            { method: "token_refresh", timestamp: at(10) },
          ],
        },
        undefined,
        now,
      ),
    ).toBe("active");
  });

  it("is recognised by the cookie only for the same session", () => {
    const claims = { amr: [{ method: "otp", timestamp: at(60) }], session_id: "s1" };
    expect(recoveryState(claims, "s1", now)).toBe("active");
    expect(recoveryState(claims, "s2", now)).toBe("none");
  });

  it("ends after 15 minutes", () => {
    const claims = { amr: [{ method: "recovery", timestamp: at(RECOVERY_SECONDS + 1) }] };
    expect(recoveryState(claims, undefined, now)).toBe("expired");
  });

  it("is not an ordinary sign-in, nor a later one", () => {
    expect(
      recoveryState({ amr: [{ method: "password", timestamp: at(30) }] }, undefined, now),
    ).toBe("none");
    expect(
      recoveryState(
        {
          amr: [
            { method: "recovery", timestamp: at(600) },
            { method: "password", timestamp: at(30) },
          ],
        },
        undefined,
        now,
      ),
    ).toBe("none");
    expect(recoveryState(null, "s1", now)).toBe("none");
  });

  it("reaches only the reset page, its API, the email links and signing out", () => {
    for (const path of [
      "/redefinir-senha",
      "/api/account/password",
      "/auth/sair",
      "/auth/confirm",
    ]) {
      expect(allowedDuringRecovery(path), path).toBe(true);
    }
    for (const path of [
      "/meus-sites",
      "/conta",
      "/criar",
      "/admin",
      "/api/sites",
      "/api/account/me",
      "/",
    ]) {
      expect(allowedDuringRecovery(path), path).toBe(false);
    }
  });
});
