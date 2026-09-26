/**
 * File: src/components/ui/Modal.tsx
 * TypeScript Modal/Dialog component
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "full";
  closeOnBackdrop?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  size = "md",
  closeOnBackdrop = true,
}) => {
  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: "modal-box max-w-sm",
    md: "modal-box max-w-2xl",
    lg: "modal-box max-w-5xl",
    full: "modal-box max-w-7xl",
  };

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  const modalContent = (
    <div className="modal modal-open" onClick={handleBackdropClick}>
      <div
        className={`${sizeClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  className = "",
  onClose,
}) => {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <h3 className="font-bold text-lg">{children}</h3>
      {onClose && (
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost"
          aria-label="Close"
        >
          ✕
        </button>
      )}
    </div>
  );
};

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = "",
}) => {
  return <div className={`py-4 ${className}`}>{children}</div>;
};

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = "",
}) => {
  return <div className={`modal-action ${className}`}>{children}</div>;
};
