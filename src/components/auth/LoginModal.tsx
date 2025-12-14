'use client';

import { Modal } from '@/components/ui/Modal';
import { LoginFormContent } from './LoginFormContent';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup?: () => void;
}

export function LoginModal({ isOpen, onClose, onSwitchToSignup }: LoginModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Welcome Back">
      <LoginFormContent
        onSuccess={onClose}
        onSwitchToSignup={onSwitchToSignup}
        showLogo={false} // Modal has its own title
        isFullPage={false}
      />
    </Modal>
  );
}