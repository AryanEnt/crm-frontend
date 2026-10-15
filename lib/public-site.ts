import type { Metadata } from "next";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
export const publicSiteUrl = configuredSiteUrl ? new URL(configuredSiteUrl) : undefined;

if (publicSiteUrl) {
  if (
    publicSiteUrl.username ||
    publicSiteUrl.password ||
    publicSiteUrl.pathname !== "/" ||
    publicSiteUrl.search ||
    publicSiteUrl.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be an origin without a path, query, or credentials.",
    );
  }

  if (process.env.NODE_ENV === "production" && publicSiteUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }
}

export function publicPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...(publicSiteUrl
      ? {
          metadataBase: publicSiteUrl,
          alternates: { canonical: new URL(path, publicSiteUrl) },
        }
      : {}),
  };
}
