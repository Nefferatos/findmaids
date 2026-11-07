"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck, UserRound } from "lucide-react";

export type ProfileUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

const roleLabels: Record<string, string> = {
  VISITOR: "Employer",
  AGENCY: "Agency owner",
  STAFF: "FindMaids staff",
  ADMIN: "Administrator",
};

function initialsFor(user: ProfileUser) {
  const source = (user.name?.trim() || user.email?.split("@")[0] || "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

const itemClass =
  "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-black/[0.04]";

export function ProfileMenu({
  user,
  align = "right",
}: {
  user: ProfileUser;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (container.current && !container.current.contains(event.target as Node))
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const role = user.role ?? "VISITOR";
  const displayName = user.name?.trim() || user.email || "Account";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-md border bg-white px-2.5 py-1.5 text-sm font-semibold hover:bg-black/[0.03]"
      >
        <span
          aria-hidden="true"
          className="bg-primary grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        >
          {initialsFor(user)}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>

      <div
        role="menu"
        aria-label="Account"
        hidden={!open}
        className={`absolute z-50 mt-2 w-64 overflow-hidden rounded-md border bg-white shadow-lg ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-bold">{displayName}</p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            <p className="text-primary mt-1 text-xs font-bold uppercase">
              {roleLabels[role] ?? role}
            </p>
          </div>

          <Link
            role="menuitem"
            href="/account"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <UserRound aria-hidden="true" className="size-4" />
            Profile
          </Link>

          {role === "AGENCY" ? (
            <Link
              role="menuitem"
              href="/agency/dashboard"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <LayoutDashboard aria-hidden="true" className="size-4" />
              Agency dashboard
            </Link>
          ) : null}

          {role === "ADMIN" || role === "STAFF" ? (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <ShieldCheck aria-hidden="true" className="size-4" />
              Admin area
            </Link>
          ) : null}

          <button
            role="menuitem"
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className={`${itemClass} border-t disabled:opacity-60`}
          >
            <LogOut aria-hidden="true" className="size-4" />
            {signingOut ? "Signing out…" : "Log out"}
          </button>
      </div>
    </div>
  );
}
