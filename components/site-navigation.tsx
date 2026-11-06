"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LogIn } from "lucide-react";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Agencies", href: "/agencies" },
  { label: "Enquiry", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "Guides", href: "/guides" },
  { label: "About", href: "/about" },
  { label: "Join Us!", href: "/advertise", emphasized: true },
];

export function SiteHeader() {
  return (
    <header className="site-header border-b">
      <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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
          <Link className="site-login-link" href="/login">
            <LogIn aria-hidden="true" className="size-4" />
            <span>Employer login</span>
          </Link>
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
