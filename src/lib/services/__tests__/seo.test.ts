import { describe, it, expect } from 'vitest';
import { generateMetadata } from '../../seo';

describe('SEO Generator', () => {
  it('generates default metadata correctly', () => {
    const metadata = generateMetadata({});
    
    // Expect the default title from your code
    expect(metadata.title).toBe('Stacq'); 
    expect((metadata.openGraph as any)?.type).toBe('website');
  });

  it('overrides title and description correctly', () => {
    const metadata = generateMetadata({
      title: 'My Awesome Stack',
      description: 'Best tools for 2024'
    });

    // FIX: Match the suffix logic in your code (`${title} | ${SITE_NAME}`)
    expect(metadata.title).toBe('My Awesome Stack | Stacq');
    expect(metadata.description).toBe('Best tools for 2024');
    
    // Check OpenGraph
    expect(metadata.openGraph?.title).toBe('My Awesome Stack | Stacq');
    expect(metadata.openGraph?.description).toBe('Best tools for 2024');
  });

  it('generates correct image URL', () => {
    // Test with relative URL
    const metadata = generateMetadata({
      image: '/og-custom.png'
    });

    // FIX: Your code ensures absolute URLs for images
    // Assuming SITE_URL defaults to https://stacq.app if env is missing in test
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://stacq.app";
    
    expect(metadata.openGraph?.images).toEqual([
      { 
        url: `${baseUrl}/og-custom.png`,
        width: 1200,
        height: 630,
        alt: 'Stacq'
      }
    ]);
  });
});