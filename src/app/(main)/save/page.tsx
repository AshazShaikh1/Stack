'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreateCardModal } from '@/components/card/CreateCardModal';
import { createClient } from '@/lib/supabase/client';

function SavePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  // Safe access with optional chaining, though Suspense makes it safe
  const url = searchParams?.get('url');
  const fileParam = searchParams?.get('file');

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setIsChecking(false);

      if (!user) {
        // Redirect to home page which will show landing page
        router.push('/');
      }
    };

    checkAuth();
  }, [router]);

  const handleClose = () => {
    // Redirect to home page after closing
    router.push('/');
  };

  // Parse file data if present
  let initialFileData = null;
  if (fileParam) {
    try {
      initialFileData = JSON.parse(decodeURIComponent(fileParam));
    } catch (e) {
      console.error('Failed to parse file data:', e);
    }
  }

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-jet border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen">
      <CreateCardModal
        isOpen={true}
        onClose={handleClose}
        initialUrl={url || undefined}
        initialFileData={initialFileData || undefined}
      />
    </div>
  );
}

export default function SavePage() {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-jet border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SavePageContent />
    </Suspense>
  );
}