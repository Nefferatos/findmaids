/**
 * Password handling shared by sign-in (`auth.ts`), registration, password reset
 * and the agency password change.
 *
 * Supabase Auth is the credential authority whenever it is configured: the
 * password grant decides sign-in, the Admin API stores new passwords. Accounts
 * that predate the integration — and deployments/display runs that set
 * `SUPABASE_AUTH_DISABLED=true` — keep working through bcrypt. A successful
 * bcrypt sign-in links the account to Supabase in the background, so existing
 * users migrate on their next login without a password reset.
 */
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  supabaseAuthEnabled,
  supabaseCreateUser,
  supabaseDeleteUser,
  supabaseFindUserIdByEmail,
  supabasePasswordGrant,
  supabaseSetPassword,
} from "@/lib/supabase-auth";

/** Credential fields the helpers below need from a `User` row. */
export type CredentialUser = {
  id: string;
  email: string;
  name?: string | null;
  supabaseUserId: string | null;
  passwordHash: string | null;
};

/** bcrypt hash used by deployments that do not run Supabase Auth. */
export function localPasswordHash(password: string) {
  return hash(password, 12);
}

async function rememberSupabaseLink(userId: string, supabaseUserId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { supabaseUserId },
    });
  } catch (error) {
    // The password was already proved; a failed link only means the next
    // sign-in repeats it.
    logger.warn(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Unable to store the Supabase identity link",
    );
  }
}

/**
 * Creates (or reuses) a Supabase identity for an account whose password has
 * already been proved by the caller, and returns its id **only when Supabase
 * actually accepts that password**.
 *
 * The final check matters: an identity that rejects its own password (for
 * example a project with Authentication > Providers > Email switched off) must
 * never take over the account, because the next sign-in would be decided by an
 * identity that cannot succeed and would lock the owner out.
 */
export async function linkSupabaseIdentity(
  user: CredentialUser,
  password: string,
): Promise<string | null> {
  // An identity that already accepts this password needs no write at all.
  const existing = await supabasePasswordGrant({
    email: user.email,
    password,
  });
  if (existing.ok && existing.userId) return existing.userId;

  const created = await supabaseCreateUser({
    email: user.email,
    password,
    name: user.name ?? null,
  });
  let candidate = created.ok ? (created.userId ?? null) : null;
  if (!candidate) {
    if (created.error !== "email_exists") return null;
    const id = await supabaseFindUserIdByEmail(user.email);
    if (!id || !(await supabaseSetPassword(id, password))) return null;
    candidate = id;
  }

  const confirmation = await supabasePasswordGrant({
    email: user.email,
    password,
  });
  if (confirmation.ok && confirmation.userId === candidate) return candidate;
  // Roll back an identity we just created so it cannot block a later retry with
  // the same address.
  if (created.ok && created.userId) await supabaseDeleteUser(created.userId);
  return null;
}

/**
 * True when the password belongs to the account.
 *
 * Linked accounts are decided by Supabase alone — a local hash must never let
 * someone in after their identity was removed. Unlinked (legacy) accounts prove
 * the bcrypt hash first and are then migrated.
 */
export async function verifyAccountPassword(
  user: CredentialUser,
  password: string,
): Promise<boolean> {
  if (!supabaseAuthEnabled()) {
    return (
      Boolean(user.passwordHash) && (await compare(password, user.passwordHash))
    );
  }
  if (user.supabaseUserId) {
    const grant = await supabasePasswordGrant({
      email: user.email,
      password,
    });
    if (!grant.ok && grant.error !== "invalid_credentials") {
      // Wrong password is normal traffic; anything else means the integration is
      // misconfigured or Supabase is down, and the operator needs to see why.
      logger.warn(
        { reason: grant.error },
        "Supabase password grant did not complete",
      );
    }
    return grant.ok && grant.userId === user.supabaseUserId;
  }
  if (!user.passwordHash || !(await compare(password, user.passwordHash)))
    return false;
  const linked = await linkSupabaseIdentity(user, password);
  if (linked) await rememberSupabaseLink(user.id, linked);
  return true;
}

/**
 * Stores a new password in Supabase.
 *
 * Returns false when Supabase rejected or could not be reached; the caller
 * decides how to surface that (both the reset and change-password routes answer
 * 503 and leave the old password in place). Without Supabase the caller stores
 * `localPasswordHash()` instead, so this is a no-op.
 */
export async function applyNewPassword(
  user: CredentialUser,
  newPassword: string,
  options: { currentPassword?: string } = {},
): Promise<boolean> {
  if (!supabaseAuthEnabled()) return true;
  if (user.supabaseUserId)
    return supabaseSetPassword(user.supabaseUserId, newPassword);
  // Legacy account: link with the password that was already proved (the current
  // one, or the new one for a reset), then store the new password.
  const identity = await linkSupabaseIdentity(
    user,
    options.currentPassword ?? newPassword,
  );
  if (!identity) return false;
  if (
    options.currentPassword &&
    !(await supabaseSetPassword(identity, newPassword))
  )
    return false;
  await rememberSupabaseLink(user.id, identity);
  return true;
}
