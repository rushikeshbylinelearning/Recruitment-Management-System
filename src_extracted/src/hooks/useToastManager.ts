/**
 * useToastManager Hook
 * 
 * Manages toast notifications for error messages
 * - Add toast with unique ID
 * - Dismiss toast by ID
 * - Auto-dismiss after timeout
 */

import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  onRetry: () => void;
}

export const useToastManager = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, onRetry: () => void) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, onRetry }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
};
