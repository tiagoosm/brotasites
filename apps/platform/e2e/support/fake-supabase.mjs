// A fake Supabase for the e2e tests, on http://localhost:54390 (playwright.config.ts). The
// platform's server talks to it: the proxy's session check, the account routes (sign-up,
// sign-in, links, password, email, deletion) and the rate limiter. The browser's own calls are
// still answered inside each test (support/supabase.ts). Emails never leave: they wait in an
// outbox the tests read at /__test/outbox. State is in memory; tests use their own emails.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54390);
const users = new Map(); // id -> { id, email, password, confirmed, meta, newEmail }
const outbox = []; // { to, type, tokenHash, redirectTo }
const tokens = new Map(); // tokenHash -> { userId, type, email }
const limits = new Map();
const calls = [];

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unb64 = (value) => JSON.parse(Buffer.from(value, "base64url").toString());

function jwtFor(user, method) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      aal: "aal1",
      amr: [{ method, timestamp: now }],
      session_id: randomUUID(),
      exp: now + 3600,
      iat: now,
      email_confirmed_at: user.confirmed ? new Date().toISOString() : null,
    }),
    "assinatura",
  ].join(".");
}

function userJson(user) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.confirmed ? "2026-10-29T00:00:00Z" : null,
    new_email: user.newEmail ?? undefined,
    app_metadata: { provider: "email" },
    user_metadata: user.meta ?? {},
    identities: [],
    factors: [],
    created_at: "2026-10-29T00:00:00Z",
  };
}

function session(user, method) {
  return {
    access_token: jwtFor(user, method),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `r-${user.id}`,
    user: userJson(user),
  };
}

/** The user of a request's bearer token: a known one, or the one the token describes. */
function bearerUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    const claims = unb64(part);
    if (!claims.sub || claims.exp * 1000 < Date.now()) return null;
    const known = users.get(claims.sub);
    if (known) return known;
    if (deleted.has(claims.sub)) return null;
    // Tests sign in with a cookie made by hand (support/supabase.ts, signIn).
    return {
      id: claims.sub,
      email: claims.email,
      confirmed: claims.email_confirmed_at !== null,
      meta: {},
    };
  } catch {
    return null;
  }
}
const deleted = new Set();

const byEmail = (email) => [...users.values()].find((user) => user.email === email);

function mail(to, type, user, redirectTo) {
  const tokenHash = createHash("sha256").update(randomBytes(16)).digest("hex");
  tokens.set(tokenHash, { userId: user.id, type, email: to });
  outbox.push({ to, type, tokenHash, redirectTo, at: Date.now() });
}

// The browser calls this address too (the session check of the account pages), from the
// platform's origin: answer CORS like Supabase does.
let cors = {};
function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", ...cors });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const error = (res, status, code, msg) =>
  send(res, status, { code: status, error_code: code, msg });

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function captchaOk(body) {
  // CAPTCHA "simulated" in e2e: a token is optional, "falha" fails.
  return body?.gotrue_meta_security?.captcha_token !== "falha";
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";
  cors = {
    "access-control-allow-origin": req.headers.origin ?? "*",
    "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-credentials": "true",
    vary: "Origin",
  };
  if (method === "OPTIONS") return send(res, 204);
  calls.push({ method, path, at: Date.now() });

  // Test helpers ---------------------------------------------------------------------------
  if (path === "/__test/outbox") {
    const to = url.searchParams.get("to");
    return send(
      res,
      200,
      outbox.filter((item) => !to || item.to === to),
    );
  }
  if (path === "/__test/user") {
    const user = byEmail(url.searchParams.get("email"));
    return send(res, 200, user ? { ...userJson(user), password: undefined } : null);
  }
  if (path === "/__test/calls") return send(res, 200, calls);
  if (path === "/__test/profile") {
    const user = byEmail(url.searchParams.get("email"));
    return send(res, 200, user?.profile ?? null);
  }
  if (path === "/__test/users" && method === "POST") {
    const body = await readJson(req);
    const user = {
      id: randomUUID(),
      email: body.email,
      password: body.password,
      confirmed: body.confirmed !== false,
      meta: { full_name: body.fullName ?? "", terms_version: "2026-10-draft" },
    };
    users.set(user.id, user);
    return send(res, 200, userJson(user));
  }

  // Auth ------------------------------------------------------------------------------------
  if (path === "/auth/v1/signup" && method === "POST") {
    const body = await readJson(req);
    if (!captchaOk(body))
      return error(res, 400, "captcha_failed", "captcha protection: request disallowed");
    const existing = byEmail(body.email);
    if (existing) {
      // Supabase answers an existing email with a look-alike user and sends nothing.
      return send(res, 200, { ...userJson({ ...existing, id: randomUUID() }), identities: [] });
    }
    const user = {
      id: randomUUID(),
      email: body.email,
      password: body.password,
      confirmed: false,
      meta: body.data ?? {},
    };
    users.set(user.id, user);
    mail(user.email, "signup", user, url.searchParams.get("redirect_to"));
    return send(res, 200, userJson(user));
  }

  if (path === "/auth/v1/token" && method === "POST") {
    const grant = url.searchParams.get("grant_type");
    const body = await readJson(req);
    if (grant === "password") {
      if (!captchaOk(body))
        return error(res, 400, "captcha_failed", "captcha protection: request disallowed");
      const user = byEmail(body.email);
      if (!user || user.password !== body.password)
        return error(res, 400, "invalid_credentials", "Invalid login credentials");
      if (!user.confirmed) return error(res, 400, "email_not_confirmed", "Email not confirmed");
      return send(res, 200, session(user, "password"));
    }
    if (grant === "refresh_token") {
      const user = users.get(String(body.refresh_token ?? "").replace(/^r-/, ""));
      if (!user) return error(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      return send(res, 200, session(user, "token_refresh"));
    }
    return error(res, 400, "unsupported_grant_type", "unsupported");
  }

  if (path === "/auth/v1/otp" && method === "POST") {
    const body = await readJson(req);
    if (!captchaOk(body))
      return error(res, 400, "captcha_failed", "captcha protection: request disallowed");
    const user = byEmail(body.email);
    if (!user) return error(res, 422, "otp_disabled", "Signups not allowed for otp");
    mail(user.email, "magiclink", user, url.searchParams.get("redirect_to"));
    return send(res, 200, {});
  }

  if (path === "/auth/v1/recover" && method === "POST") {
    const body = await readJson(req);
    if (!captchaOk(body))
      return error(res, 400, "captcha_failed", "captcha protection: request disallowed");
    const user = byEmail(body.email);
    if (user) mail(user.email, "recovery", user, url.searchParams.get("redirect_to"));
    return send(res, 200, {});
  }

  if (path === "/auth/v1/resend" && method === "POST") {
    const body = await readJson(req);
    const user = byEmail(body.email);
    if (user && !user.confirmed)
      mail(user.email, "signup", user, url.searchParams.get("redirect_to"));
    return send(res, 200, {});
  }

  if (path === "/auth/v1/verify" && method === "POST") {
    const body = await readJson(req);
    const token = tokens.get(body.token_hash);
    if (!token) return error(res, 403, "otp_expired", "Email link is invalid or has expired");
    tokens.delete(body.token_hash);
    const user = users.get(token.userId);
    if (!user) return error(res, 403, "otp_expired", "Email link is invalid or has expired");
    if (token.type === "signup") user.confirmed = true;
    if (token.type === "email_change") {
      user.email = token.email;
      user.newEmail = undefined;
    }
    const methods = {
      signup: "otp",
      magiclink: "otp",
      email: "otp",
      recovery: "recovery",
      email_change: "email_change",
    };
    return send(res, 200, session(user, methods[token.type] ?? "otp"));
  }

  if (path === "/auth/v1/user") {
    const user = bearerUser(req);
    if (!user) return error(res, 401, "bad_jwt", "invalid JWT");
    if (method === "PUT") {
      const body = await readJson(req);
      if (body.password) {
        if (body.password === user.password)
          return error(
            res,
            422,
            "same_password",
            "New password should be different from the old password.",
          );
        user.password = body.password;
      }
      if (body.email) {
        if (byEmail(body.email))
          return error(res, 422, "email_exists", "Email address already registered");
        user.newEmail = body.email;
        mail(body.email, "email_change", user, url.searchParams.get("redirect_to"));
      }
      if (!users.has(user.id)) users.set(user.id, user);
      return send(res, 200, userJson(user));
    }
    return send(res, 200, userJson(user));
  }

  if (path === "/auth/v1/logout") return send(res, 204);

  if (path.startsWith("/auth/v1/admin/users/") && method === "DELETE") {
    const id = path.split("/").pop();
    users.delete(id);
    deleted.add(id);
    return send(res, 200, {});
  }

  // Database (only what the platform's server reads) ----------------------------------------
  if (path === "/rest/v1/rpc/server_rate_limit") {
    const body = await readJson(req);
    const used = (limits.get(body.p_key) ?? 0) + 1;
    limits.set(body.p_key, used);
    return send(res, 200, used <= body.p_max);
  }
  if (path === "/rest/v1/rpc/server_delete_account") {
    const body = await readJson(req);
    return send(res, 200, {
      sites: 1,
      retainedPayments: 0,
      purges: [{ siteId: "7d1c1a52-2f0e-4c39-9a35-6b1f4a8e2c10", subdomain: null }],
      userId: body.p_user_id,
    });
  }
  if (path === "/rest/v1/profiles") {
    const user = bearerUser(req);
    if (method === "PATCH") {
      if (!user) return send(res, 200, []);
      const body = await readJson(req);
      user.profile = body;
      user.meta = { ...user.meta, full_name: body.full_name ?? user.meta?.full_name };
      user.phone = body.phone ?? null;
      return send(res, 204);
    }
    const profile = user
      ? {
          full_name: user.meta?.full_name ?? "",
          phone: user.phone ?? null,
          terms_version: user.meta?.terms_version ?? null,
          has_password: Boolean(user.password),
        }
      : null;
    const single = String(req.headers.accept).includes("vnd.pgrst.object");
    if (single)
      return profile
        ? send(res, 200, profile)
        : send(res, 406, { code: "PGRST116", message: "no rows" });
    return send(res, 200, profile ? [profile] : []);
  }
  if (path === "/rest/v1/sites" && url.searchParams.get("id")) {
    // ownSite(): any site id is the person's, ready for approval.
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    const row = {
      id,
      status: "awaiting_approval",
      subdomain: "padaria-do-ze",
      approved_direction: null,
    };
    const single = String(req.headers.accept).includes("vnd.pgrst.object");
    if (!bearerUser(req))
      return single ? send(res, 406, { code: "PGRST116", message: "no rows" }) : send(res, 200, []);
    return send(res, 200, single ? row : [row]);
  }
  if (path.startsWith("/rest/v1/")) {
    const single = String(req.headers.accept).includes("vnd.pgrst.object");
    return single ? send(res, 406, { code: "PGRST116", message: "no rows" }) : send(res, 200, []);
  }
  if (path.startsWith("/storage/v1/object/list/")) return send(res, 200, []);

  return error(res, 404, "not_found", `fake supabase: no route for ${method} ${path}`);
});

server.listen(PORT, () => console.log(`fake supabase on ${PORT}`));
