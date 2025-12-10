/**
 * Amazon Affiliate Link Utility
 * Detects Amazon product links and adds affiliate tags
 */

interface AmazonAffiliateConfig {
  tag: string; // Your Amazon Associates tag (e.g., "yourstore-20")
  domains?: string[]; // Amazon domains to process (defaults to common ones)
}

// Default Amazon domains
const DEFAULT_AMAZON_DOMAINS = [
  'amazon.com',
  'amazon.co.uk',
  'amazon.ca',
  'amazon.de',
  'amazon.fr',
  'amazon.es',
  'amazon.it',
  'amazon.co.jp',
  'amazon.in',
  'amazon.com.au',
  'amazon.com.br',
  'amazon.com.mx',
  'amazon.nl',
  'amazon.se',
  'amazon.pl',
  'amazon.sg',
  'amazon.ae',
  'amazon.sa',
  'amazon.tr',
  'amazon.eg',
];

/**
 * Check if a URL is an Amazon product link
 */
export function isAmazonLink(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    
    // Check if it's an Amazon domain
    const isAmazonDomain = DEFAULT_AMAZON_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    
    if (!isAmazonDomain) {
      return false;
    }
    
    // Check if it's a product page (contains /dp/, /gp/product/, /product/, or /d/)
    const pathname = urlObj.pathname.toLowerCase();
    const isProductPage = 
      pathname.includes('/dp/') ||
      pathname.includes('/gp/product/') ||
      pathname.includes('/product/') ||
      pathname.includes('/d/') ||
      pathname.match(/^\/[a-z]{2}\/dp\//); // Country-specific product pages like /us/dp/
    
    return !!isProductPage;
  } catch {
    return false;
  }
}

/**
 * Extract Amazon ASIN from URL
 */
export function extractAmazonASIN(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Common patterns for ASIN in Amazon URLs:
    // /dp/ASIN
    // /gp/product/ASIN
    // /product/ASIN
    // /d/ASIN
    // /[country]/dp/ASIN
    
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
      /\/d\/([A-Z0-9]{10})/i,
      /\/[a-z]{2}\/dp\/([A-Z0-9]{10})/i, // Country-specific
    ];
    
    for (const pattern of patterns) {
      const match = pathname.match(pattern);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Add Amazon affiliate tag to URL
 * Preserves existing query parameters and adds/updates the tag parameter
 */
export function addAmazonAffiliateTag(
  url: string,
  config: AmazonAffiliateConfig
): string {
  if (!isAmazonLink(url)) {
    return url; // Return original URL if not Amazon
  }
  
  if (!config.tag) {
    return url; // Return original URL if no tag configured
  }
  
  try {
    const urlObj = new URL(url);
    
    // Get the ASIN to construct a clean affiliate URL
    const asin = extractAmazonASIN(url);
    
    if (!asin) {
      // If we can't extract ASIN, just add tag to existing URL
      urlObj.searchParams.set('tag', config.tag);
      return urlObj.toString();
    }
    
    // Construct clean affiliate URL with ASIN
    // Format: https://amazon.com/dp/ASIN?tag=YOUR_TAG
    const domain = urlObj.hostname;
    const cleanUrl = new URL(`https://${domain}/dp/${asin}`);
    
    // Preserve important query parameters (ref, sr, etc.)
    const importantParams = ['ref', 'sr', 'keywords', 'qid', 'th'];
    for (const param of importantParams) {
      const value = urlObj.searchParams.get(param);
      if (value) {
        cleanUrl.searchParams.set(param, value);
      }
    }
    
    // Add affiliate tag (this will override any existing tag)
    cleanUrl.searchParams.set('tag', config.tag);
    
    return cleanUrl.toString();
  } catch (error) {
    // If URL parsing fails, return original URL
    console.error('Error adding Amazon affiliate tag:', error);
    return url;
  }
}

/**
 * Get Amazon affiliate configuration from environment
 */
export function getAmazonAffiliateConfig(): AmazonAffiliateConfig | null {
  const tag = process.env.AMAZON_AFFILIATE_TAG || process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;
  
  if (!tag) {
    return null;
  }
  
  return {
    tag,
    domains: process.env.AMAZON_AFFILIATE_DOMAINS?.split(',').map(d => d.trim()) || DEFAULT_AMAZON_DOMAINS,
  };
}
