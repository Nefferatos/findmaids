import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  supabaseAuthEnabled,
  supabaseCreateUser,
  supabaseDeleteUser,
  supabaseFindUserIdByEmail,
  supabasePasswordGrant,
  supabaseSetPassword,
} from "@/lib/supabase-auth";

/**
 * Supabase Auth credentials: the GoTrue calls plus the bcrypt fallback/linking
 * policy in `lib/credentials.ts`.
 *
 * `fetch` is always stubbed — these tests must never reach the real Supabase
 * project, and `vitest.config.mts` pins SUPABASE_AUTH_DISABLED for the rest of
 * the suite.
 */
process.env.PRISMA_MOCK = "true";
delete process.env.PRISMA_MOCK_FILE;

type Reply = { status?: number; body?: unknown };
type FetchCall = { url: string; init: RequestInit };

const authEnvKeys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_AUTH_DISABLED",
] as const;
const savedEnv = Object.fromEntries(
  authEnvKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof authEnvKeys)[number], string | undefined>;

function configureSupabase(overrides: Record<string, string | undefined> = {}) {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_AUTH_DISABLED;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function stubFetch(replies: Reply[]) {
  const calls: FetchCall[] = [];
  const queue = [...replies];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const reply = queue.shift() ?? {
        status: 500,
        body: { message: "unexpected request" },
      };
      return new Response(JSON.stringify(reply.body ?? {}), {
        status: reply.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

function bodyOf(call: FetchCall) {
  return JSON.parse(String(call.init.body ?? "{}")) as Record<string, unknown>;
}

function headersOf(call: FetchCall) {
  return (call.init.headers ?? {}) as Record<string, string>;
}

const password = "Valid-test-password-821!";
let prisma: PrismaClient;
let credentials: typeof import("@/lib/credentials");

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  credentials = await import("@/lib/credentials");
});

beforeEach(() => {
  configureSupabase();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await prisma.user.deleteMany({});
});

afterAll(() => {
  for (const key of authEnvKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("supabase auth configuration", () => {
  it("is disabled when the project is not configured", () => {
    configureSupabase({ SUPABASE_URL: undefined });
    expect(supabaseAuthEnabled()).toBe(false);
  });

  it("can be switched off for offline runs even with credentials present", () => {
    configureSupabase({ SUPABASE_AUTH_DISABLED: "true" });
    expect(supabaseAuthEnabled()).toBe(false);
  });

  it("is enabled with a project URL and a key", () => {
    expect(supabaseAuthEnabled()).toBe(true);
  });
});

describe("supabase users", () => {
  it("creates the identity with the app-owned verification flag", async () => {
    const calls = stubFetch([{ status: 200, body: { id: "auth-user-1" } }]);

    await expect(
      supabaseCreateUser({
        email: "employer@example.test",
        password,
        name: "Employer",
        accountType: "employer",
      }),
    ).resolves.toEqual({ ok: true, userId: "auth-user-1" });

    expect(calls[0].url).toBe(
      "https://project.supabase.co/auth/v1/admin/users",
    );
    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(calls[0]).apikey).toBe("service-role-key");
    expect(headersOf(calls[0]).Authorization).toBe("Bearer service-role-key");
    expect(bodyOf(calls[0])).toMatchObject({
      email: "employer@example.test",
      // The app sends its own verification e-mail (`/api/verify-email`).
      email_confirm: true,
      user_metadata: { name: "Employer", account_type: "employer" },
    });
  });

  it("reports an existing identity instead of throwing", async () => {
    stubFetch([
      {
        status: 422,
        body: {
          code: 422,
          error_code: "email_exists",
          msg: "User already registered",
        },
      },
    ]);
    await expect(
      supabaseCreateUser({ email: "taken@example.test", password }),
    ).resolves.toEqual({ ok: false, error: "email_exists" });
  });

  it("treats a network failure as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ETIMEDOUT");
      }),
    );
    await expect(
      supabaseCreateUser({ email: "down@example.test", password }),
    ).resolves.toEqual({ ok: false, error: "unavailable" });
  });

  it("sets a password through the admin endpoint", async () => {
    const calls = stubFetch([{ status: 200, body: { id: "auth-user-1" } }]);
    await expect(
      supabaseSetPassword("auth-user-1", "New-password-123"),
    ).resolves.toBe(true);
    expect(calls[0].url).toBe(
      "https://project.supabase.co/auth/v1/admin/users/auth-user-1",
    );
    expect(calls[0].init.method).toBe("PUT");
    expect(bodyOf(calls[0])).toEqual({ password: "New-password-123" });
  });

  it("deletes an identity and tolerates an already-deleted one", async () => {
    const calls = stubFetch([
      { status: 200, body: {} },
      { status: 404, body: {} },
    ]);
    await expect(supabaseDeleteUser("auth-user-1")).resolves.toBe(true);
    await expect(supabaseDeleteUser("auth-user-1")).resolves.toBe(true);
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("finds an existing identity by e-mail across pages", async () => {
    // A full first page without the address, then the match on page two.
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      id: `user-${index}`,
      email: `other-${index}@example.test`,
    }));
    stubFetch([
      { status: 200, body: { users: firstPage } },
      {
        status: 200,
        body: { users: [{ id: "found", email: "Legacy@Example.test" }] },
      },
    ]);
    await expect(
      supabaseFindUserIdByEmail("legacy@example.test"),
    ).resolves.toBe("found");
  });

  describe("supabase password grant", () => {
    it("verifies the password and returns the identity id", async () => {
      const calls = stubFetch([
        {
          status: 200,
          body: { user: { id: "auth-user-1" }, access_token: "t" },
        },
      ]);
      await expect(
        supabasePasswordGrant({ email: "employer@example.test", password }),
      ).resolves.toEqual({ ok: true, userId: "auth-user-1" });
      expect(calls[0].url).toBe(
        "https://project.supabase.co/auth/v1/token?grant_type=password",
      );
      // The anon key is preferred so sign-in does not carry the service role.
      expect(headersOf(calls[0]).apikey).toBe("anon-key");
      expect(bodyOf(calls[0])).toMatchObject({
        email: "employer@example.test",
        password,
      });
    });

    it("falls back to the service key when no anon key is configured", async () => {
      configureSupabase({ SUPABASE_ANON_KEY: undefined });
      const calls = stubFetch([
        { status: 400, body: { error: "invalid_grant" } },
      ]);
      await expect(
        supabasePasswordGrant({ email: "employer@example.test", password }),
      ).resolves.toEqual({ ok: false, error: "invalid_credentials" });
      expect(headersOf(calls[0]).apikey).toBe("service-role-key");
    });

    it("maps a wrong password to invalid credentials", async () => {
      stubFetch([
        {
          status: 400,
          body: {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          },
        },
      ]);
      await expect(
        supabasePasswordGrant({
          email: "employer@example.test",
          password: "nope",
        }),
      ).resolves.toEqual({ ok: false, error: "invalid_credentials" });
    });

    it("names a disabled Email provider instead of a bad password", async () => {
      // Real GoTrue response for a project with Authentication > Providers >
      // Email switched off; the app must not report this as a wrong password.
      stubFetch([
        {
          status: 422,
          body: {
            code: 422,
            error_code: "email_provider_disabled",
            msg: "Email logins are disabled",
          },
        },
      ]);
      await expect(
        supabasePasswordGrant({ email: "employer@example.test", password }),
      ).resolves.toEqual({ ok: false, error: "email_provider_disabled" });
    });
  });

  async function createUser(
    overrides: Partial<{
      passwordHash: string | null;
      supabaseUserId: string | null;
    }> = {},
  ) {
    return prisma.user.create({
      data: {
        email: `user-${Math.random().toString(36).slice(2)}@example.test`,
        name: "Linked User",
        emailVerified: new Date(),
        passwordHash: await hash(password, 12),
        ...overrides,
      },
    });
  }

  describe("verifyAccountPassword", () => {
    it("accepts the password Supabase returns for the linked identity", async () => {
      const user = await createUser({ supabaseUserId: "auth-user-1" });
      stubFetch([{ status: 200, body: { user: { id: "auth-user-1" } } }]);
      await expect(
        credentials.verifyAccountPassword(user, password),
      ).resolves.toBe(true);
    });

    it("never falls back to the local hash once an identity is linked", async () => {
      // Correct bcrypt hash, but Supabase rejects the password: the local copy
      // must not become a second way in.
      const user = await createUser({ supabaseUserId: "auth-user-1" });
      stubFetch([{ status: 400, body: { error: "invalid_grant" } }]);
      await expect(
        credentials.verifyAccountPassword(user, password),
      ).resolves.toBe(false);
    });

    it("rejects a grant for a different identity", async () => {
      const user = await createUser({ supabaseUserId: "auth-user-1" });
      stubFetch([{ status: 200, body: { user: { id: "someone-else" } } }]);
      await expect(
        credentials.verifyAccountPassword(user, password),
      ).resolves.toBe(false);
    });

    it("links a legacy bcrypt account after a correct password", async () => {
      const user = await createUser();
      stubFetch([
        // No identity yet: the first grant fails, then the account is created
        // and confirmed with a second grant.
        { status: 400, body: { error: "invalid_grant" } },
        { status: 200, body: { id: "auth-new" } },
        { status: 200, body: { user: { id: "auth-new" } } },
      ]);

      await expect(
        credentials.verifyAccountPassword(user, password),
      ).resolves.toBe(true);

      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stored?.supabaseUserId).toBe("auth-new");
    });

    it("does not link an account whose identity rejects the password", async () => {
      // Real case: the project has Authentication > Providers > Email disabled,
      // so the identity exists but can never sign in. Linking it would lock the
      // owner out on the next sign-in, so the account must stay on bcrypt.
      const user = await createUser();
      const calls = stubFetch([
        {
          status: 422,
          body: { error_code: "email_provider_disabled" },
        },
        { status: 200, body: { id: "auth-unusable" } },
        {
          status: 422,
          body: { error_code: "email_provider_disabled" },
        },
        { status: 200, body: {} },
      ]);

      await expect(
        credentials.verifyAccountPassword(user, password),
      ).resolves.toBe(true);

      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stored?.supabaseUserId).toBeNull();
      expect(calls.map((call) => call.init.method)).toEqual([
        "POST",
        "POST",
        "POST",
        "DELETE",
      ]);
    });

    it("rejects a legacy account with the wrong password without calling Supabase", async () => {
      const user = await createUser();
      const calls = stubFetch([]);
      await expect(
        credentials.verifyAccountPassword(user, "wrong-password"),
      ).resolves.toBe(false);
      expect(calls).toHaveLength(0);
    });

    it("uses bcrypt alone when Supabase Auth is switched off", async () => {
      configureSupabase({ SUPABASE_AUTH_DISABLED: "true" });
      const user = await createUser();
      const calls = stubFetch([]);
      await expect(
        credentials.verifyAccountPassword(user, password),
      ).resolves.toBe(true);
      await expect(
        credentials.verifyAccountPassword(user, "wrong-password"),
      ).resolves.toBe(false);
      expect(calls).toHaveLength(0);
    });
  });

  describe("applyNewPassword", () => {
    it("writes the new password to the linked identity", async () => {
      const user = await createUser({ supabaseUserId: "auth-user-1" });
      const calls = stubFetch([{ status: 200, body: {} }]);
      await expect(
        credentials.applyNewPassword(user, "New-password-123"),
      ).resolves.toBe(true);
      expect(calls[0].url).toBe(
        "https://project.supabase.co/auth/v1/admin/users/auth-user-1",
      );
      expect(bodyOf(calls[0])).toEqual({ password: "New-password-123" });
    });

    it("links a legacy identity that already exists in the project", async () => {
      const user = await createUser();
      const calls = stubFetch([
        // 1. no identity accepts the password yet
        { status: 400, body: { error: "invalid_grant" } },
        // 2. creating it reports that the address is taken
        { status: 422, body: { error_code: "email_exists" } },
        // 3. the existing identity is found by e-mail …
        {
          status: 200,
          body: { users: [{ id: "auth-legacy", email: user.email }] },
        },
        // 4. … given the password …
        { status: 200, body: { id: "auth-legacy" } },
        // 5. … and confirmed with a grant
        { status: 200, body: { user: { id: "auth-legacy" } } },
      ]);
      const result = await credentials.applyNewPassword(
        user,
        "New-password-123",
      );

      expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
        "POST https://project.supabase.co/auth/v1/token?grant_type=password",
        "POST https://project.supabase.co/auth/v1/admin/users",
        "GET https://project.supabase.co/auth/v1/admin/users?page=1&per_page=200",
        "PUT https://project.supabase.co/auth/v1/admin/users/auth-legacy",
        "POST https://project.supabase.co/auth/v1/token?grant_type=password",
      ]);
      expect(result).toBe(true);
      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stored?.supabaseUserId).toBe("auth-legacy");
    });

    it("fails closed when Supabase cannot store the password", async () => {
      const user = await createUser({ supabaseUserId: "auth-user-1" });
      stubFetch([{ status: 500, body: { message: "upstream error" } }]);
      await expect(
        credentials.applyNewPassword(user, "New-password-123"),
      ).resolves.toBe(false);
    });
  });
});
