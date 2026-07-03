/**
 * NotificationBell
 * Reads notification state from NotificationContext (no local polling).
 * The context also drives desktop toast popups automatically.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, CheckCheck, Calendar, Clock, Info, ArrowRight, ClipboardList } from 'lucide-react';
import { useNotifications, AppNotification } from '../contexts/NotificationContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notifIcon(type: string) {
  if (type === 'interview_scheduled')
    return (
      <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <Calendar size={18} className="text-indigo-600" />
      </div>
    );
  if (type === 'interview_rescheduled')
    return (
      <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Clock size={18} className="text-amber-600" />
      </div>
    );
  if (type === 'interview_reminder')
    return (
      <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Bell size={18} className="text-blue-600" />
      </div>
    );
  if (type === 'duplicate_application')
    return (
      <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
        <Info size={18} className="text-red-800" />
      </div>
    );
  if (type === 'task_update' || type === 'task_assigned')
    return (
      <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
        <ClipboardList size={18} className="text-violet-600" />
      </div>
    );
  return (
    <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Info size={18} className="text-gray-500" />
    </div>
  );
}

function typeBadge(type: string) {
  if (type === 'interview_scheduled')   return { label: 'Scheduled',    cls: 'bg-indigo-50 text-indigo-600' };
  if (type === 'interview_rescheduled') return { label: 'Rescheduled',  cls: 'bg-amber-50 text-amber-600' };
  if (type === 'interview_reminder')    return { label: 'Reminder',     cls: 'bg-blue-50 text-blue-600' };
  if (type === 'duplicate_application') return { label: 'Duplicate',    cls: 'bg-red-100 text-red-900' };
  if (type === 'task_update')           return { label: 'Work Update',  cls: 'bg-violet-50 text-violet-600' };
  if (type === 'task_assigned')         return { label: 'Task Assigned',cls: 'bg-violet-50 text-violet-600' };
  return { label: 'Info', cls: 'bg-gray-100 text-gray-500' };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen]         = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleNotifClick = (notif: AppNotification) => {
    if (!notif.is_read) markRead(notif.id);
    setOpen(false);
    if (notif.link) window.location.href = notif.link;
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    await markAllRead();
    setMarkingAll(false);
  };

  const unread = notifications.filter(n => !n.is_read);
  const read   = notifications.filter(n =>  n.is_read);

  const drawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[420px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Bell size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Notifications</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={17} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 px-8">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center">
                <Bell size={36} className="opacity-30" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-500">No notifications yet</p>
                <p className="text-sm mt-1">You'll see interview updates and reminders here.</p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-1">
              {unread.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 pb-2">
                    New
                  </p>
                  {unread.map(notif => (
                    <NotifCard key={notif.id} notif={notif} onClick={() => handleNotifClick(notif)} />
                  ))}
                </>
              )}
              {read.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 pt-4 pb-2">
                    Earlier
                  </p>
                  {read.map(notif => (
                    <NotifCard key={notif.id} notif={notif} onClick={() => handleNotifClick(notif)} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60">
          <a
            href="/tasks"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            View Tasks &amp; Updates
            <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
        aria-label="Open notifications"
      >
        <Bell size={20} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-0.5 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {createPortal(drawer, document.body)}
    </>
  );
}

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({ notif, onClick }: { notif: AppNotification; onClick: () => void }) {
  const badge   = typeBadge(notif.type);
  const isUnread = !notif.is_read;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex gap-3 p-3 rounded-2xl transition-all group ${
        isUnread ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-gray-50'
      }`}
    >
      {notifIcon(notif.type)}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <span className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
            {notif.title}
          </span>
          {isUnread && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5" />}
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{notif.message}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-[11px] text-gray-400">{timeAgo(notif.created_at)}</span>
        </div>
      </div>
    </button>
  );
}
