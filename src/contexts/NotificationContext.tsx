/**
 * NotificationContext
 *
 * Single source of truth for in-app notifications.
 * - Polls /api/notifications every 30 s
 * - Detects newly-arrived unread IDs (IDs not seen in the previous poll)
 * - Fires desktop toast popups for new notifications
 * - Exposes the full list + unread count to NotificationBell (no double-polling)
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, Calendar, Clock, Info, ClipboardList, X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { subscribeToPush } from '../services/notificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean | number;
  created_at: string;
}

interface ToastItem {
  id: number;          // same as notification id
  type: string;
  title: string;
  message: string;
  link: string | null;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  refetch: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  refetch: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;
const TOAST_TTL_MS = 6_000;   // auto-dismiss after 6 s
const MAX_TOASTS = 4;          // max simultaneous toasts

function toastIcon(type: string) {
  const base = 'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center';
  if (type === 'interview_scheduled' || type === 'interview_rescheduled')
    return <div className={`${base} bg-indigo-100`}><Calendar size={16} className="text-indigo-600" /></div>;
  if (type === 'interview_reminder')
    return <div className={`${base} bg-blue-100`}><Clock size={16} className="text-blue-600" /></div>;
  if (type === 'task_update' || type === 'task_assigned')
    return <div className={`${base} bg-violet-100`}><ClipboardList size={16} className="text-violet-600" /></div>;
  if (type === 'duplicate_application')
    return <div className={`${base} bg-red-100`}><Info size={16} className="text-red-600" /></div>;
  return <div className={`${base} bg-gray-100`}><Bell size={16} className="text-gray-500" /></div>;
}

function typeBadge(type: string): string {
  if (type === 'task_update')          return 'Work Update';
  if (type === 'task_assigned')        return 'Task Assigned';
  if (type === 'interview_scheduled')  return 'Interview';
  if (type === 'interview_reminder')   return 'Reminder';
  if (type === 'duplicate_application')return 'Duplicate';
  return 'Notification';
}

function typeBadgeCls(type: string): string {
  if (type === 'task_update' || type === 'task_assigned')
    return 'bg-violet-100 text-violet-700';
  if (type.startsWith('interview'))
    return 'bg-indigo-100 text-indigo-700';
  if (type === 'duplicate_application')
    return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

// ─── Single toast bubble ──────────────────────────────────────────────────────

function ToastBubble({
  toast,
  index,
  onDismiss,
}: {
  toast: ToastItem;
  index: number;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  // slide-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // auto-dismiss
  useEffect(() => {
    const t = setTimeout(() => handleClose(), TOAST_TTL_MS);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300); // wait for slide-out
  }

  function handleClick() {
    handleClose();
    if (toast.link) window.location.href = toast.link;
  }

  const offsetY = index * 80; // stack offset — each toast shifts down 80 px

  return (
    <div
      className="pointer-events-auto"
      style={{
        transform: visible
          ? `translateX(0) translateY(${offsetY}px)`
          : `translateX(110%) translateY(${offsetY}px)`,
        transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
        opacity: visible ? 1 : 0,
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100%',
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 flex items-start gap-3 p-4 cursor-pointer group"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
        onClick={handleClick}
        role="alert"
        aria-live="polite"
      >
        {toastIcon(toast.type)}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">
              {toast.title}
            </p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${typeBadgeCls(toast.type)}`}>
              {typeBadge(toast.type)}
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{toast.message}</p>
        </div>

        <button
          onClick={e => { e.stopPropagation(); handleClose(); }}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={13} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Toast stack portal ───────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        top: '72px',        // below the header/navbar
        right: '24px',
        width: '360px',
        maxWidth: 'calc(100vw - 48px)',
        zIndex: 99999,
        // Height is the (n-1) * 80 offset + estimated last card height (~80px)
        height: `${(toasts.length - 1) * 80 + 90}px`,
      }}
    >
      {toasts.map((t, i) => (
        <ToastBubble key={t.id} toast={t} index={i} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const [notifications, setNotifications]   = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [toasts, setToasts]                 = useState<ToastItem[]>([]);

  // Track which notification IDs we've already shown as toasts
  const seenIds = useRef<Set<number>>(new Set());
  // Track whether this is the very first fetch (don't toast on initial load)
  const isFirstFetch = useRef(true);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success) return;

      const incoming: AppNotification[] = json.data.notifications ?? [];
      const count: number = json.data.unreadCount ?? 0;

      setNotifications(incoming);
      setUnreadCount(count);

      if (isFirstFetch.current) {
        // Seed seenIds with everything already in the DB — no toasts on load
        incoming.forEach(n => seenIds.current.add(n.id));
        isFirstFetch.current = false;
        return;
      }

      // Find genuinely new unread notifications
      const newUnread = incoming.filter(
        n => !n.is_read && !seenIds.current.has(n.id)
      );

      if (newUnread.length > 0) {
        newUnread.forEach(n => seenIds.current.add(n.id));

        setToasts(prev => {
          // Append new toasts, cap at MAX_TOASTS
          const next = [
            ...newUnread.slice(0, MAX_TOASTS).map(n => ({
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              link: n.link,
            })),
            ...prev,
          ];
          return next.slice(0, MAX_TOASTS);
        });
      }
    } catch {
      // silent — never crash the app over notifications
    }
  }, [isAuthenticated]);

  // ── Poll every 30 s ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    refetch();
    // Also ensure push subscription is registered whenever user is authenticated
    if (Notification.permission === 'granted') {
      subscribeToPush().catch(() => {});
    }
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, refetch]);

  // ── Reset on logout ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
      seenIds.current.clear();
      isFirstFetch.current = true;
    }
  }, [isAuthenticated]);

  // ── Mark read ──────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: number) => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  // ── Dismiss a toast bubble ─────────────────────────────────────────────────
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refetch, markRead, markAllRead }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}
