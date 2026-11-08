"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LogIn } from "lucide-react";
import { ProfileMenu, type ProfileUser } from "@/components/profile-menu";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Search Maid", href: "/#maid-search" },
  { label: "Maid Agency", href: "/agencies" },
  { label: "Enquiry", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "News", href: "/guides" },
  { label: "Join as Maid Agency", href: "/advertise", emphasized: true },
];

export function SiteHeader({ user }: { user?: ProfileUser | null }) {
  return (
    <header className="site-header border-b">
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
        <div className="flex items-center gap-2 sm:gap-3">
          <Link className="site-requirements-link" href="/contact">
            <span>Submit your requirements</span>
            <ArrowRight aria-hidden="true" className="size-4" />
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

  return (
    <nav className="site-tab-nav" aria-label="Main navigation">
      <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex min-w-max items-stretch gap-1">
          {navigation.map(({ label, href, emphasized }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className={emphasized ? "ml-auto" : undefined}>
                <Link
                  href={href}
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
