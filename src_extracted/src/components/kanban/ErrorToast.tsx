/**
 * ErrorToast Component
 * 
 * Displays error messages with retry functionality
 * - Auto-dismiss after 5 seconds
 * - Manual dismiss button
 * - Retry button
 * - Slide-up animation
 */

import { X, AlertCircle, RotateCw } from 'lucide-react';
import { useEffect } from 'react';

interface ErrorToastProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
  autoHideDuration?: number;
}

export const ErrorToast = ({
  message,
  onRetry,
  onDismiss,
  autoHideDuration = 5000,
}: ErrorToastProps) => {
  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(onDismiss, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [autoHideDuration, onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-2xl border border-red-200 p-4 min-w-[320px] max-w-[400px]">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle size={18} className="text-red-600" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 mb-1">Sync Failed</p>
            <p className="text-sm text-gray-600">{message}</p>
          </div>

          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
          >
            <RotateCw size={14} />
            <span>Retry</span>
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
