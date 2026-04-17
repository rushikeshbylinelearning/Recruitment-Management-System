import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = '420px'
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Autofocus first input
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const firstInput = drawerRef.current.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 150);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Render drawer using portal to attach to document.body
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 transition-opacity duration-300"
        style={{ 
          zIndex: 9998,
          animation: 'fadeIn 250ms ease-in-out',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="fixed right-0 top-0 h-full bg-white shadow-2xl flex flex-col"
        style={{
          zIndex: 9999,
          width,
          animation: 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.12), -4px 0 16px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0 bg-gradient-to-b from-white to-gray-50/30">
          <div className="flex-1 min-w-0 pr-4">
            <h2 id="drawer-title" className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 flex-shrink-0 group"
            aria-label="Close drawer"
          >
            <X size={18} className="text-gray-500 group-hover:text-gray-700 transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gradient-to-t from-white to-gray-50/30">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </>,
    document.body
  );
}
