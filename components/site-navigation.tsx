"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LogIn } from "lucide-react";
import { ProfileMenu, type ProfileUser } from "@/components/profile-menu";

const navigation: {
  label: string;
  href: string;
  emphasized?: boolean;
  activePaths?: string[];
}[] = [
  { label: "Home", href: "/" },
  {
    label: "Search Maid",
    href: "/maids/search",
    // Results and maid profiles belong to the same section, like /agencies.
    activePaths: ["/maids"],
  },
  { label: "Maid Agency", href: "/maid-agency", activePaths: ["/agencies"] },
  { label: "Enquiry", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "News", href: "/guides" },
  { label: "Join as Maid Agency", href: "/advertise", emphasized: true },
] as const;

export function SiteHeader({ user: providedUser }: { user?: ProfileUser | null }) {
  // The public shell renders this header without reading the session server
  // side (doing that made every page dynamic). When no user is passed in, the
  // signed-in state is resolved after hydration so static pages stay static
  // while logged-in visitors still see the account menu.
  const [user, setUser] = useState<ProfileUser | null>(providedUser ?? null);

  useEffect(() => {
    if (providedUser !== undefined) return;
    let cancelled = false;
    fetch("/api/auth/session", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((session) => {
        if (cancelled) return;
        setUser((session?.user as ProfileUser | undefined) ?? null);
      })
      .catch(() => {
        // Anonymous visitors and offline reloads simply keep the login link.
      });
    return () => {
      cancelled = true;
    };
  }, [providedUser]);

  return (
    <header className="site-header border-b">
      <div className="site-topbar">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-1 sm:px-6 lg:px-8">
          <p>Singapore maid agency directory</p>
          <div className="flex items-center gap-3">
            <Link href="/maid-agency">Maid agency directory</Link>
            <Link href="/maid-agency/map">Agencies near me</Link>
            <Link href="/login">Agency login</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="FindMaids home"
          className="site-brand inline-flex items-center gap-2"
        >
          <span className="site-brand-mark" aria-hidden="true">
            F
          </span>
          <span className="font-display text-2xl font-bold tracking-tight">
            FindMaids
          </span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link className="site-requirements-link" href="/contact">
            <span>Submit your requirements</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link className="site-agency-login" href="/login">
            Agency login
          </Link>
          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <Link className="site-login-link" href="/login">
              <LogIn aria-hidden="true" className="size-4" />
              <span>Employer login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function TabNav() {
  const pathname = usePathname();

  /**
   * Hash links (for example an old `/#maid-search` bookmark) stay on the
   * current page when it already matches, so scroll to the target ourselves.
   * Without this, Next re-runs the same-route navigation and resets the page to
   * the top when the link is clicked a second time.
   */
  const handleSectionLink = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;
    // Let modified clicks open a new tab/window as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (event.button !== 0) return;
    const targetPath = href.slice(0, hashIndex) || "/";
    if (pathname !== targetPath) return;
    const target = document.getElementById(href.slice(hashIndex + 1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", href);
  };

  return (
    <nav className="site-tab-nav" aria-label="Main navigation">
      <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex min-w-max items-stretch gap-1">
          {navigation.map(({ label, href, emphasized, activePaths }) => {
            const sectionPaths = [href, ...(activePaths ?? [])];
            const active =
              href === "/"
                ? pathname === "/"
                : sectionPaths.some(
                    (path) =>
                      pathname === path || pathname.startsWith(`${path}/`),
                  );
            return (
              <li key={href} className={emphasized ? "ml-auto" : undefined}>
                <Link
                  href={href}
                  onClick={(event) => handleSectionLink(event, href)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "site-tab-link",
                    active && "is-active",
                    emphasized && "is-emphasized",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
