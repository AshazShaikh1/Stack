"use client";

import React, { useEffect, useState, useRef } from "react";
import { focusManagement } from "@/lib/accessibility";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setShouldRender(true);
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = "unset";
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };

    if (isOpen && modalRef.current) {
      document.addEventListener("keydown", handleEscape);
      const timer = setTimeout(() => {
        // focusManagement.trapFocus(modalRef.current); // Uncomment if using focus trap lib
      }, 100);
      return () => {
        document.removeEventListener("keydown", handleEscape);
        clearTimeout(timer);
      };
    }
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  const sizeStyles = {
    sm: "max-w-md", // Great for Login/Signup
    md: "max-w-2xl", // Great for Create Options
    lg: "max-w-4xl", // Great for large forms
  };

  return (
    <>
      {/* Backdrop (High Z-Index) */}
      <div
        className={`fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Container (Center Alignment) */}
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {/* Modal Content */}
        <div
          ref={modalRef}
          className={`
            relative bg-white rounded-2xl shadow-2xl w-full ${sizeStyles[size]}
            max-h-[90dvh] flex flex-col pointer-events-auto
            transform transition-all duration-300 ease-out
            ${
              isVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-8 scale-95"
            }
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || true) && ( // Always render a header area for the close button
            <div
              className={`flex items-center justify-between px-6 py-4 ${
                title
                  ? "border-b border-gray-100"
                  : "absolute right-0 top-0 z-10"
              }`}
            >
              {title && (
                <h2
                  id="modal-title"
                  className="text-xl font-bold text-jet-dark"
                >
                  {title}
                </h2>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-400 hover:text-jet-dark hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
        </div>
      </div>
    </>
  );
};
