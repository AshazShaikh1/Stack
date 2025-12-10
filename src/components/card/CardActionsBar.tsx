'use client';

import { useVotes } from '@/hooks/useVotes';
import { useSaves } from '@/hooks/useSaves';
import { useToast } from '@/contexts/ToastContext';

interface CardActionsBarProps {
  cardId: string;
  initialUpvotes: number;
  initialSaves: number;
  shareUrl: string;
  title: string;
}

export function CardActionsBar({ 
  cardId, 
  initialUpvotes, 
  initialSaves, 
  shareUrl,
  title 
}: CardActionsBarProps) {
  const { showSuccess, showError } = useToast();

  const { upvotes, voted, isLoading: isVoting, toggleVote } = useVotes({
    targetType: 'card',
    targetId: cardId,
    initialUpvotes,
    initialVoted: false, // Ideally fetch this state, but hooks handle client-side check
  });

  const { saves, saved, isLoading: isSaving, toggleSave } = useSaves({
    cardId: cardId,
    targetType: 'card',
    initialSaves,
    initialSaved: false,
  });

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          url: shareUrl,
        });
      } catch (err) {
        // Ignore abort errors
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showSuccess('Link copied to clipboard!');
      } catch (err) {
        showError('Failed to copy link');
      }
    }
  };

  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-100">
      {/* Upvote Button */}
      <button
        onClick={toggleVote}
        disabled={isVoting}
        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 border ${
          voted 
            ? 'bg-red-50 border-red-200 text-red-500' 
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <svg 
          className={`w-5 h-5 ${voted ? 'fill-current' : 'none'}`} 
          fill={voted ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <span className="font-medium">{upvotes}</span>
      </button>

      {/* Save Button */}
      <button
        onClick={toggleSave}
        disabled={isSaving}
        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 border ${
          saved 
            ? 'bg-emerald-50 border-emerald-200 text-emerald' 
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <svg 
          className={`w-5 h-5 ${saved ? 'fill-current' : 'none'}`}
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <span className="font-medium">{saves}</span>
      </button>

      {/* Share Button */}
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all duration-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <span className="font-medium">Share</span>
      </button>
    </div>
  );
}