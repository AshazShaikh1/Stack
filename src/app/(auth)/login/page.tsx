'use client';

import { Suspense } from 'react';
import { LoginFormContent } from '@/components/auth/LoginFormContent';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cloud px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-card p-8">
          {/* Suspense boundary is required because LoginFormContent (or its children)
            uses client-side search params (useSearchParams), which causes a 
            bailout during static generation.
          */}
          <Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
            <LoginFormContent
              isFullPage={true}
              showLogo={true}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}