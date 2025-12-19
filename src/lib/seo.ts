import { Metadata } from "next";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  publishedTime?: string;
  author?: string;
  noIndex?: boolean; // <--- New Prop
}

export function generateMetadata({
  title,
  description,
  image,
  url,
  type = "website",
  publishedTime,
  author,
  noIndex = false, // Default to indexable
}: SEOProps): Metadata {
  const siteName = "Stacq";
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://stacq.app";
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const fullDescription =
    description || "Discover and share curated resources with the community";
  const fullImage = image || `${siteUrl}/og-image.png`;
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl;

  return {
    title: fullTitle,
    description: fullDescription,
    openGraph: {
      type,
      title: fullTitle,
      description: fullDescription,
      url: fullUrl,
      siteName,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: title || siteName,
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
    },
    alternates: {
      canonical: fullUrl,
    },
    // <--- Enforce Robot Rules Here
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };
}
