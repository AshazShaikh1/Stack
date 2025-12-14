'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';

interface ReportButtonProps {
  targetType: 'stack' | 'card' | 'comment' | 'user' | 'collection';
  targetId: string;
  variant?: 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function ReportButton({ targetType, targetId, variant = 'ghost', size = 'sm' }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Logic to handle 'ghost' variant which might not be native to the UI component
  const isGhost = variant === 'ghost';
  const buttonVariant = isGhost ? 'outline' : variant; 
  const ghostClasses = isGhost ? 'border-none shadow-none bg-transparent hover:bg-gray-100' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('Please sign in to report');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setReason('');
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant={buttonVariant}
        size={size}
        className={ghostClasses}
        onClick={() => setIsOpen(true)}
      >
        🚩 Report
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setReason('');
          setError(null);
          setSuccess(false);
        }}
        title="Report Content"
      >
        {success ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-h2 font-semibold text-jet-dark mb-2">
              Report Submitted
            </h3>
            <p className="text-body text-gray-muted">
              Thank you for your report. We&apos;ll review it shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-body font-medium text-jet-dark mb-2">
                Reason for reporting
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                placeholder="Please describe why you're reporting this content..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent resize-none text-body"
                maxLength={500}
                required
              />
              <div className="text-small text-gray-muted mt-1">
                {reason.length}/500 characters
              </div>
            </div>

            {error && (
              <div className="text-small text-red-500">{error}</div>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  setReason('');
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !reason.trim()}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}