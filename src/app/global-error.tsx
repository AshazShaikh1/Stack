'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Global Application Crash', error);
  }, [error]);

  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-gray-50 text-center p-4 font-sans">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Critical System Error</h2>
          <p className="text-gray-600 mb-6">Our system encountered a critical failure. We have been notified.</p>
          <button
            onClick={() => reset()}
            className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            Attempt Recovery
          </button>
        </div>
      </body>
    </html>
  );
}