"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/contexts/ToastContext";

interface UseSavesOptions {
  stackId?: string; // Legacy support
  collectionId?: string;
  cardId?: string;
  targetType?: "collection" | "card";
  targetId?: string; // Generic ID support
  initialSaves?: number;
  initialSaved?: boolean;
}

export function useSaves({
  stackId,
  collectionId,
  cardId,
  targetType,
  targetId, // Support generic ID
  initialSaves = 0,
  initialSaved = false,
}: UseSavesOptions) {
  // Resolve actual ID and Type
  const id = targetId || collectionId || cardId || stackId;
  const type = targetType || (cardId ? "card" : "collection");

  const [saves, setSaves] = useState(initialSaves);
  const [saved, setSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Use Toast Context
  const { showSuccess, showError } = useToast();
  // NOTE: If your ToastContext exports 'showInfo', add it here.
  // If not, we will use 'showError' for auth prompts.

  const fetchSaveStatus = useCallback(async () => {
    if (!id) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Get save count
    const { count, error: fetchError } = await supabase
      .from("saves")
      .select("*", { count: "exact", head: true })
      .eq("target_type", type)
      .eq("target_id", id);

    if (fetchError) {
      console.error("Error fetching save count:", fetchError);
      return;
    }

    if (count !== null) setSaves(count);

    // Check if user has saved
    if (user) {
      const { data: userSave } = await supabase
        .from("saves")
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", type)
        .eq("target_id", id)
        .maybeSingle();

      setSaved(!!userSave);
    }
  }, [id, type]);

  useEffect(() => {
    // Sync if initial props change
    setSaves(initialSaves);
    setSaved(initialSaved);

    // Fetch fresh status if not provided or to ensure accuracy
    // (Optional: You can skip this if you trust initial props 100%)
    fetchSaveStatus();
  }, [id, type, initialSaves, initialSaved, fetchSaveStatus]);

  const toggleSave = async () => {
    if (!id) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const itemName = type === "card" ? "cards" : "collections";
      showError(`Please sign in to save ${itemName}`);
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
      return;
    }

    // Start animation
    setIsAnimating(true);
    setIsLoading(true);
    setError(null);

    // Optimistic Update
    const previousSaved = saved;
    const previousSaves = saves;
    setSaved(!saved);
    setSaves((prev) => (!saved ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const response = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: type,
          target_id: id,
          // Send specific IDs for backward compatibility if API needs them
          collection_id: type === "collection" ? id : undefined,
          card_id: type === "card" ? id : undefined,
          stack_id: stackId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          showError(`Please sign in to save`);
          setTimeout(() => (window.location.href = "/login"), 1500);
          throw new Error("Unauthorized");
        }
        throw new Error(data.error || "Failed to save");
      }

      // Sync with server response
      const newSavedState = data.saved;
      setSaved(newSavedState);
      if (typeof data.saves === "number") {
        setSaves(data.saves);
      }

      // Success Toast
      const itemName = type === "card" ? "Card" : "Collection";
      if (newSavedState) {
        showSuccess(`${itemName} saved!`);
        trackEvent.save(user.id, id);
      } else {
        showSuccess(`${itemName} unsaved`);
        trackEvent.unsave(user.id, id);
      }
    } catch (err: any) {
      // Revert Optimistic Update
      setSaved(previousSaved);
      setSaves(previousSaves);

      setError(err.message);
      if (err.message !== "Unauthorized") {
        showError(err.message || "Failed to save");
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsAnimating(false), 300);
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
