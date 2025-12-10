import { redirect } from 'next/navigation';
import { lazy } from 'react';

// Lazy load comments section - it's heavy and not always needed immediately
const CommentsSection = lazy(() => import('@/components/comments/CommentsSection').then(m => ({ default: m.CommentsSection })));

interface StackPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Legacy route: /stack/[id] redirects to /collection/[id]
 * This maintains backward compatibility for old links
 */
export default async function StackPage({ params }: StackPageProps) {
  const { id } = await params;
  // Redirect to the new collection route
  redirect(`/collection/${id}`);
}

