/**
 * NotificationPermissionBanner
 *
 * A dismissible bottom-right card shown once when Notification permission
 * is 'default'. Triggers browser permission prompt on button click only.
 * Remembered via localStorage — never shown again after dismiss or grant.
 */
import { useState, useEffect } from 'react';
import { Bell, X, Smartphone } from 'lucide-react';
import { requestPermission, subscribeToPush } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

const DISMISSED_KEY = 'notif_banner_dismissed_v2';

export default function NotificationPermissionBanner() {
  const { isAuthenticated } = useAuth();
  const [visible,    setVisible]    = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [granted,    setGranted]    = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function handleEnable() {
    setRequesting(true);
    try {
      const permission = await requestPermission();
      if (permission === 'granted') {
        await subscribeToPush();
        setGranted(true);
        setTimeout(dismiss, 2000);
      } else {
        dismiss();
      }
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-[99998] w-80 pointer-events-auto"
      style={{ animation: 'slideUpFade 0.4s cubic-bezier(0.16,1,0.3,1)' }}
      role="dialog"
      aria-label="Enable desktop notifications"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {/* Colour accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />

        <div className="p-4">
          {granted ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center py-2 gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Bell size={18} className="text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Notifications enabled!</p>
              <p className="text-xs text-gray-500">You'll receive desktop alerts for work updates.</p>
            </div>
          ) : (
            /* ── Default state ── */
            <>
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  <Bell size={18} className="text-white" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 leading-snug">
                    Stay in the loop
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Get instant desktop alerts when team members submit work updates — even when the tab is in the background.
                  </p>
                </div>

                {/* Close */}
                <button
                  onClick={dismiss}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 -mt-0.5"
                  aria-label="Dismiss"
                >
                  <X size={13} className="text-gray-400" />
                </button>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {['Work updates', 'Task assignments', 'Interview reminders'].map(f => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                    {f}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleEnable}
                  disabled={requesting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}
                >
                  <Smartphone size={12} />
                  {requesting ? 'Enabling…' : 'Enable notifications'}
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Not now
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
