import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { unauthorized } from './errors';

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthUser(request: NextRequest) {
  const supabase = await createClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    throw unauthorized();
  }
  
  return user;
}

