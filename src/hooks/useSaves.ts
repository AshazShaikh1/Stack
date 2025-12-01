'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/analytics';

interface UseSavesOptions {
  stackId: string;
  initialSaves?: number;
  initialSaved?: boolean;
}

export function useSaves({ stackId, initialSaves = 0, initialSaved = false }: UseSavesOptions) {
  const [saves, setSaves] = useState(initialSaves);
  const [saved, setSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSaveStatus = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get save count
    const { count } = await supabase
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('stack_id', stackId);

    setSaves(count || 0);

    // Check if user has saved
    if (user) {
      const { data: userSave } = await supabase
        .from('saves')
        .select('id')
        .eq('user_id', user.id)
        .eq('stack_id', stackId)
        .maybeSingle();

      setSaved(!!userSave);
    }
  }, [stackId]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Fetch initial save status
    fetchSaveStatus();
  }, [stackId, fetchSaveStatus]);

  const toggleSave = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      if (confirm('Please sign in to save stacks. Would you like to sign in now?')) {
        window.location.href = '/login';
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/saves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stack_id: stackId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          if (confirm('Please sign in to save stacks. Would you like to sign in now?')) {
            window.location.href = '/login';
          }
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }

      // Optimistic update
      setSaved(data.saved);
      setSaves(prev => data.saved ? prev + 1 : prev - 1);

      // Track analytics
      if (data.saved && user) {
        trackEvent.viewStack(user.id, stackId);
      }
    } catch (err: any) {
      setError(err.message);
      // Revert optimistic update
      fetchSaveStatus();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    saves,
    saved,
    isLoading,
    error,
    toggleSave,
  };
}

