import { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://stacq.app";
const SITE_NAME = "Stacq";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`; // Ensure this file exists in /public

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string; // Relative path (e.g., "/explore")
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  author?: string;
  noIndex?: boolean;
}

export function generateMetadata({
  title,
  description,
  image,
  url = "/",
  type = "website",
  publishedTime,
  author,
  noIndex = false,
}: SEOProps): Metadata {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const fullDescription =
    description || "Discover and share curated resources with the community.";

  // Ensure image is absolute URL
  const fullImage = image
    ? image.startsWith("http")
      ? image
      : `${SITE_URL}${image}`
    : DEFAULT_OG_IMAGE;

  // Clean URL (remove trailing slash, ensure absolute)
  const cleanPath = url === "/" ? "" : url.replace(/\/$/, "");
  const canonicalUrl = `${SITE_URL}${cleanPath}`;

  if (noIndex) {
    return {
      title: fullTitle,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: fullTitle,
    description: fullDescription,
    applicationName: SITE_NAME,
    metadataBase: new URL(SITE_URL), // Critical for resolving relative OG images
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type,
      title: fullTitle,
      description: fullDescription,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(author && { authors: [author] }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: fullDescription,
      images: [fullImage],
      creator: "@stacq_app", // Update with your handle
    },
  };
}
