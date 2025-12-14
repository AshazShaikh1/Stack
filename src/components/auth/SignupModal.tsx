'use client';

import { Modal } from '@/components/ui/Modal';
import { SignupFormContent } from './SignupFormContent';
import { useToast } from '@/contexts/ToastContext';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

export function SignupModal({ isOpen, onClose, onSwitchToLogin }: SignupModalProps) {
  const { showSuccess } = useToast();
  
  const handleSuccess = () => {
    showSuccess('Account created! Please check your email.');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Join Stacq">
      <SignupFormContent
        onSuccess={handleSuccess}
        onSwitchToLogin={onSwitchToLogin}
        showLogo={false}
        isFullPage={false}
      />
    </Modal>
  );
}