'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { useToast } from '@/contexts/ToastContext';

interface UseSavesOptions {
  stackId?: string; // Legacy support
  collectionId?: string;
  cardId?: string;
  targetType?: 'collection' | 'card';
  initialSaves?: number;
  initialSaved?: boolean;
}

export function useSaves({ 
  stackId, 
  collectionId, 
  cardId,
  targetType,
  initialSaves = 0, 
  initialSaved = false 
}: UseSavesOptions) {
  const id = collectionId || cardId || stackId;
  const type = targetType || (cardId ? 'card' : 'collection');
  const [saves, setSaves] = useState(initialSaves);
  const [saved, setSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const { showSuccess, showError } = useToast();

  const fetchSaveStatus = useCallback(async () => {
    if (!id) return;
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get save count - support target_type and target_id (new) or legacy collection_id/stack_id
    const { count, error } = await supabase
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', type)
      .eq('target_id', id);

    if (error) {
      console.error('Error fetching save count:', error);
      // Don't overwrite if there's an error - keep current value
      return;
    }

    setSaves(count || 0);

    // Check if user has saved
    if (user) {
      const { data: userSave } = await supabase
        .from('saves')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', type)
        .eq('target_id', id)
        .maybeSingle();

      setSaved(!!userSave);
    }
  }, [id, type]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    if (!id) return;

    const supabase = createClient();
    
    // Always fetch user's saved status
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('saves')
          .select('id')
          .eq('user_id', user.id)
          .eq('target_type', type)
          .eq('target_id', id)
          .maybeSingle()
          .then(({ data: userSave }) => {
            setSaved(!!userSave);
          });
      }
    });

    // Only fetch count if we don't have an initial value
    // This prevents overwriting the initial value from the feed API
    if (initialSaves === 0) {
      fetchSaveStatus();
    }
  }, [id, type]);

  const toggleSave = async () => {
    if (!id) return;
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      const itemName = type === 'card' ? 'cards' : 'collections';
      showError(`Please sign in to save ${itemName}`); // FIXED: Changed showInfo to showError
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      return;
    }

    // Start animation
    setIsAnimating(true);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/saves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: type,
          target_id: id,
          collection_id: collectionId || (type === 'collection' ? id : undefined),
          card_id: cardId || (type === 'card' ? id : undefined),
          stack_id: stackId, // Legacy support
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          const itemName = type === 'card' ? 'cards' : 'collections';
          showInfo(`Please sign in to save ${itemName}`);
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }

      // Update state with response data
      const newSavedState = data.saved;
      setSaved(newSavedState);
      // Use the save count from the API response if available, otherwise do optimistic update
      if (data.saves !== undefined) {
        setSaves(data.saves);
      } else {
        setSaves(prev => newSavedState ? prev + 1 : Math.max(0, prev - 1));
      }

      // Show toast notification
      const itemName = type === 'card' ? 'Card' : 'Collection';
      if (newSavedState) {
        showSuccess(`${itemName} saved!`);
        trackEvent.save(user.id, id);
      } else {
        showSuccess(`${itemName} unsaved`);
        trackEvent.unsave(user.id, id);
      }

      // Refresh the page data after a short delay to ensure DB is updated
      setTimeout(() => {
        fetchSaveStatus();
      }, 500);
    } catch (err: any) {
      setError(err.message);
      const itemName = type === 'card' ? 'card' : 'collection';
      showError(err.message || `Failed to save ${itemName}`);
      // Revert optimistic update
      fetchSaveStatus();
    } finally {
      setIsLoading(false);
      // End animation after a short delay
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }
  };

  return {
    saves,
    saved,
    isLoading,
    error,
    isAnimating,
    toggleSave,
  };
}

function showInfo(arg0: string) {
  throw new Error('Function not implemented.');
}

