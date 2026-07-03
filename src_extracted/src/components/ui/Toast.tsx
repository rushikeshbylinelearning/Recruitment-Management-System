import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <div
        className={`flex items-center space-x-3 px-6 py-4 rounded-xl shadow-2xl border ${
          type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}
      >
        {type === 'success' ? (
          <CheckCircle size={20} className="text-green-600" />
        ) : (
          <XCircle size={20} className="text-red-600" />
        )}
        <p className="font-medium">{message}</p>
        <button
          onClick={onClose}
          className="ml-4 p-1 hover:bg-white/50 rounded-full transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
