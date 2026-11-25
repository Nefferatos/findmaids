import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        // `/agency` is a prefix of the public `/agencies` directory, so the
        // portal is matched exactly (`/agency$`) plus its sub-paths only.
        "/agency$",
        "/agency/",
        "/api",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
