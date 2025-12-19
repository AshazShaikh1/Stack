import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/client'; // Use client or server utility depending on setup

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stacq.app';
  
  // 1. Static Routes
  const routes = [
    '',
    '/explore',
    '/pricing', // If you have one
    '/about',   // If you have one
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: 1,
  }));

  // 2. Dynamic Routes (Top 5000 Collections)
  // We fetch these so Google can find your deep content
  const supabase = createClient();
  const { data: collections } = await supabase
    .from('collections')
    .select('id, updated_at')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(5000);

  const collectionUrls = (collections || []).map((c) => ({
    url: `${baseUrl}/collection/${c.id}`,
    lastModified: c.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...routes, ...collectionUrls];
}