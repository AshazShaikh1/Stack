import * as cheerio from 'cheerio';
import normalizeUrl from 'normalize-url';

export interface MetadataResult {
  title: string;
  description: string;
  thumbnailUrl: string | null;
  canonicalUrl: string;
  domain: string;
  metadata: {
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    ogSiteName?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    author?: string;
    publishedTime?: string;
  };
}

/**
 * Canonicalize and normalize a URL
 */
export function canonicalizeUrl(url: string): string {
  try {
    return normalizeUrl(url, {
      stripWWW: true,
      removeTrailingSlash: true,
      removeQueryParameters: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'],
      sortQueryParameters: true,
      defaultProtocol: 'https',
    });
  } catch (error) {
    console.error('Error canonicalizing URL:', error);
    // Fallback to basic normalization
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('utm_source');
      urlObj.searchParams.delete('utm_medium');
      urlObj.searchParams.delete('utm_campaign');
      return urlObj.href;
    } catch {
      return url;
    }
  }
}

/**
 * Extract metadata from HTML content
 */
export async function extractMetadata(url: string, html: string): Promise<MetadataResult> {
  const $ = cheerio.load(html);
  
  // Extract Open Graph tags
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDescription = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const ogType = $('meta[property="og:type"]').attr('content') || '';
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';
  
  // Extract Twitter Card tags
  const twitterCard = $('meta[name="twitter:card"]').attr('content') || '';
  const twitterTitle = $('meta[name="twitter:title"]').attr('content') || '';
  const twitterDescription = $('meta[name="twitter:description"]').attr('content') || '';
  const twitterImage = $('meta[name="twitter:image"]').attr('content') || '';
  
  // Extract other meta tags
  const title = $('title').text() || '';
  const description = $('meta[name="description"]').attr('content') || '';
  const author = $('meta[name="author"]').attr('content') || '';
  const publishedTime = $('meta[property="article:published_time"]').attr('content') || '';
  
  // Resolve relative image URLs
  function resolveImageUrl(imageUrl: string | undefined): string | null {
    if (!imageUrl) return null;
    
    try {
      // If already absolute, return as is
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      
      // Resolve relative URLs
      const baseUrl = new URL(url);
      const resolvedUrl = new URL(imageUrl, baseUrl);
      return resolvedUrl.href;
    } catch {
      return null;
    }
  }
  
  // Priority: og:image > twitter:image > first image in content
  let thumbnailUrl = resolveImageUrl(ogImage) || resolveImageUrl(twitterImage);
  
  // Fallback: find first large image in content
  if (!thumbnailUrl) {
    const firstImage = $('img').first();
    const imgSrc = firstImage.attr('src') || firstImage.attr('data-src');
    if (imgSrc) {
      thumbnailUrl = resolveImageUrl(imgSrc);
    }
  }
  
  // Canonicalize the URL
  const canonicalUrl = canonicalizeUrl(url);
  const urlObj = new URL(canonicalUrl);
  const domain = urlObj.hostname.replace('www.', '');
  
  // Determine final title and description (priority: OG > Twitter > Meta > Title tag)
  const finalTitle = ogTitle || twitterTitle || title || '';
  const finalDescription = ogDescription || twitterDescription || description || '';
  
  return {
    title: finalTitle.trim(),
    description: finalDescription.trim(),
    thumbnailUrl,
    canonicalUrl,
    domain,
    metadata: {
      ogTitle,
      ogDescription,
      ogImage: ogImage ? resolveImageUrl(ogImage) || undefined : undefined,
      ogType,
      ogSiteName,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage: twitterImage ? resolveImageUrl(twitterImage) || undefined : undefined,
      author,
      publishedTime,
    },
  };
}

/**
 * Fetch HTML from URL and extract metadata
 */
export async function fetchMetadata(url: string): Promise<MetadataResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StacqBot/1.0; +https://stacq.com/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // For 403/404, throw a specific error that can be caught and handled silently
      if (response.status === 403 || response.status === 404) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    return await extractMetadata(url, html);
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    // Don't log expected network errors (DNS failures, connection resets, 403/404, etc.)
    // These are common for invalid URLs, network issues, or sites blocking scrapers
    const isExpectedError = 
      error.code === 'ENOTFOUND' || 
      error.code === 'EAI_AGAIN' || 
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('fetch failed') ||
      error.message?.includes('HTTP 403') ||
      error.message?.includes('HTTP 404') ||
      error.message?.includes('403') ||
      error.message?.includes('404') ||
      error.message?.includes('Forbidden') ||
      error.message?.includes('Not Found');
    
    if (!isExpectedError) {
      console.error('Unexpected error fetching metadata:', error);
    }
    
    throw error;
  }
}

