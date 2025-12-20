import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase } from '@/test/mocks/supabase';
import { redirect } from 'next/navigation';

// 1. Mock Supabase Client
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}));

// 2. Mock Next.js Navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// 3. Import guards AFTER mocks
import { requireUser } from '../guards';

describe('Auth Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login if no user is found', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await requireUser();

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('returns user if authenticated', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const result = await requireUser();

    expect(result.user).toEqual(mockUser);
    expect(redirect).not.toHaveBeenCalled();
  });
});