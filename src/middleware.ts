import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const start = Date.now();
  
  // 1. Run your existing Supabase auth logic
  // (Assuming updateSession is your main auth middleware)
  const response = await updateSession(request);

  // 2. Calculate Latency
  const duration = Date.now() - start;

  // 3. Add Server-Timing Header
  // Shows up in Chrome DevTools -> Network -> Timing
  response.headers.set('Server-Timing', `total;dur=${duration}`);
  
  // Optional: Log slow requests (>500ms)
  if (duration > 500) {
    console.warn(`⚠️ [Slow Request] ${request.nextUrl.pathname} took ${duration}ms`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};