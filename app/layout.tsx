import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteBaseUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  title: "FindMaids",
  description: "FindMaids application foundation",
  // Validated base: an empty NEXTAUTH_URL must not throw at build time.
  metadataBase: new URL(siteBaseUrl()),
  openGraph: { siteName: "FindMaids", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-SG" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
