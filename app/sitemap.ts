import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
 import { logger } from "@/lib/logger";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const staticPaths = [
    "",
    "/agencies",
    "/advertise",
    "/about",
    "/contact",
    "/faq",
    "/terms",
    "/privacy",
    "/cookies",
    "/security",
    "/guides",
    "/guides/choosing-an-agency",
    "/guides/preparing-for-a-conversation",
  ];
  const staticEntries = staticPaths.map((path) => ({
    url: new URL(path, baseUrl).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  const agencies = await prisma.agency
    .findMany({
      where: { status: "APPROVED" },
      select: { slug: true, updatedAt: true },
    })
      .catch((error) => {
        logger.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Unable to load sitemap agency URLs");
      return [];
    });
  return [
    ...staticEntries,
    ...agencies.map((agency) => ({
      url: new URL(`/agencies/${agency.slug}`, baseUrl).toString(),
      lastModified: agency.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
