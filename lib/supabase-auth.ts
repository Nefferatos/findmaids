/**
 * Supabase Auth (GoTrue) client used for sign-up, sign-in and password changes.
 *
 * Supabase owns the credentials: registration creates an `auth.users` row, a
 * sign-in is a password grant, and new passwords are written through the Admin
 * API. The app still issues its own JWT session (`auth.ts`), so roles, admin
 * TOTP, impersonation and the `disabled` / `passwordChangedAt` gates keep
 * working unchanged. `User.supabaseUserId` links a profile row to its Supabase
 * identity.
 *
 * Requests are plain `fetch` calls (the same approach as `lib/storage.ts`)
 * instead of `@supabase/supabase-js`: the Worker bundle stays small and no key
 * ever reaches the browser.
 *
 * Configuration (see `.env.example`):
 *   SUPABASE_URL                 e.g. https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY            preferred key for the password grant
 *   SUPABASE_SERVICE_ROLE_KEY    required to create/update/delete auth users
 *   SUPABASE_AUTH_DISABLED       "true" falls back to the local bcrypt path
 *                                (used by the display-only E2E run)
 */

const AUTH_TIMEOUT_MS = 8_000;
/** `GET /admin/users` is paged; this caps the fallback lookup for legacy rows. */
const USERS_PAGE_SIZE = 200;
const USERS_MAX_PAGES = 10;

export type SupabaseAuthError =
  | "email_exists"
  | "invalid_credentials"
  | "email_not_confirmed"
  /** Authentication > Providers > Email is switched off for the project. */
  | "email_provider_disabled"
  | "not_configured"
  | "unavailable";

/**
 * Result of a Supabase Auth call. Exactly one of `userId` (success) or `error`
 * (failure) is set; the fields are optional rather than a discriminated union
 * because this project compiles with `strict: false`, where `ok: true|false`
 * would not narrow.
 */
export type SupabaseUserResult = {
  ok: boolean;
  userId?: string;
  error?: SupabaseAuthError;
};

function authBaseUrl(): string | null {
  const url = process.env.SUPABASE_URL?.trim();
  return url ? `${url.replace(/\/+$/, "")}/auth/v1` : null;
}

function serviceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

/**
 * Public API key. The password grant only needs project-level apikey
 * validation, so the anon key is preferred; the service-role key is the
 * documented fallback so the integration also works with the secrets this app
 * already ships (add `SUPABASE_ANON_KEY` to avoid using the service role here).
 */
function apiKey(): string | null {
  return (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    serviceKey()
  );
}

/** True when Supabase Auth should handle sign-up/sign-in for this deployment. */
export function supabaseAuthEnabled(): boolean {
  if (process.env.SUPABASE_AUTH_DISABLED?.trim().toLowerCase() === "true")
    return false;
  return Boolean(authBaseUrl() && apiKey());
}

type AuthResponse = { status: number; payload: Record<string, unknown> };

async function authRequest(
  path: string,
  init: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    key: string;
    body?: unknown;
  },
): Promise<AuthResponse | null> {
  const base = authBaseUrl();
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, {
      method: init.method,
      headers: {
        apikey: init.key,
        Authorization: `Bearer ${init.key}`,
        ...(init.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      // A hung identity provider must not hold a sign-in open forever.
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return { status: response.status, payload };
  } catch {
    return null;
  }
}

function errorText(payload: Record<string, unknown>): string {
  return ["error_code", "error", "error_description", "msg", "message"]
    .map((key) => payload[key])
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function toError(
  payload: Record<string, unknown>,
  status: number,
): SupabaseAuthError {
  const text = errorText(payload);
  if (
    text.includes("email_provider_disabled") ||
    text.includes("email logins are disabled")
  )
    return "email_provider_disabled";
  if (text.includes("already") || text.includes("exists"))
    return "email_exists";
  if (text.includes("not confirmed") || text.includes("email_not_confirmed"))
    return "email_not_confirmed";
  if (
    text.includes("invalid") ||
    status === 400 ||
    status === 401 ||
    status === 403
  )
    return "invalid_credentials";
  return "unavailable";
}

function userIdFrom(payload: Record<string, unknown>): string | null {
  const direct = payload.id;
  if (typeof direct === "string") return direct;
  const user = payload.user;
  if (user && typeof user === "object") {
    const id = (user as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}

/**
 * Creates the Supabase identity for a new account.
 *
 * `email_confirm: true` is deliberate: the app owns email verification through
 * `User.emailVerified` + `/api/verify-email` (and its own Resend message), so
 * Supabase must neither block the password grant with its confirmation gate nor
 * send a second e-mail.
 */
export async function supabaseCreateUser(input: {
  email: string;
  password: string;
  name?: string | null;
  accountType?: "employer" | "agency";
}): Promise<SupabaseUserResult> {
  const key = serviceKey();
  if (!supabaseAuthEnabled() || !key)
    return { ok: false, error: "not_configured" };
  const result = await authRequest("/admin/users", {
    method: "POST",
    key,
    body: {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        name: input.name ?? null,
        account_type: input.accountType ?? null,
      },
    },
  });
  if (!result) return { ok: false, error: "unavailable" };
  const userId = userIdFrom(result.payload);
  if (result.status < 300 && userId) return { ok: true, userId };
  return { ok: false, error: toError(result.payload, result.status) };
}

/** Verifies an email/password pair with Supabase (`grant_type=password`). */
export async function supabasePasswordGrant(input: {
  email: string;
  password: string;
}): Promise<SupabaseUserResult> {
  const key = apiKey();
  if (!supabaseAuthEnabled() || !key)
    return { ok: false, error: "not_configured" };
  const result = await authRequest("/token?grant_type=password", {
    method: "POST",
    key,
    body: { email: input.email, password: input.password },
  });
  if (!result) return { ok: false, error: "unavailable" };
  const userId = userIdFrom(result.payload);
  if (result.status < 300 && userId) return { ok: true, userId };
  return { ok: false, error: toError(result.payload, result.status) };
}

/**
 * Finds an identity by e-mail through the Admin API. Only used while linking an
 * account that predates the integration (the common path is a stored
 * `User.supabaseUserId`).
 */
export async function supabaseFindUserIdByEmail(
  email: string,
): Promise<string | null> {
  const key = serviceKey();
  if (!key) return null;
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= USERS_MAX_PAGES; page += 1) {
    const result = await authRequest(
      `/admin/users?page=${page}&per_page=${USERS_PAGE_SIZE}`,
      { method: "GET", key },
    );
    if (!result || result.status >= 300) return null;
    const users = Array.isArray(result.payload.users)
      ? (result.payload.users as Array<Record<string, unknown>>)
      : [];
    const match = users.find(
      (user) =>
        typeof user.email === "string" && user.email.toLowerCase() === wanted,
    );
    if (match && typeof match.id === "string") return match.id;
    if (users.length < USERS_PAGE_SIZE) return null;
  }
  return null;
}

/** Sets a new password for an existing Supabase identity. */
export async function supabaseSetPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const key = serviceKey();
  if (!key || !userId) return false;
  const result = await authRequest(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: "PUT", key, body: { password } },
  );
  return Boolean(result && result.status < 300);
}

/** Removes an identity, e.g. to roll back a half-finished registration. */
export async function supabaseDeleteUser(userId: string): Promise<boolean> {
  const key = serviceKey();
  if (!key || !userId) return false;
  const result = await authRequest(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: "DELETE", key },
  );
  return Boolean(result && (result.status < 300 || result.status === 404));
}
