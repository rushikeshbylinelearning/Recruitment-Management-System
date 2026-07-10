/**
 * TaskDetailModal — Planner-style split-layout task details modal
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Header: Title · ID · Status · Priority · ... · X  │
 *   ├──────────────────────────────┬──────────────────────┤
 *   │                              │                      │
 *   │  LEFT PANEL (scrollable)     │  RIGHT PANEL         │
 *   │  § Task Information          │  (Chat / Comments)   │
 *   │  § People                    │                      │
 *   │  § Checklist                 │                      │
 *   │  § Notes                     │                      │
 *   │  § Attachments               │                      │
 *   │  § Activity Timeline         │                      │
 *   │  § History (Admin only)      │                      │
 *   │                              │                      │
 *   └──────────────────────────────┴──────────────────────┘
 *
 * All tabs are eliminated — each section is a scrollable section in the left panel.
 * The right panel is a persistent chat/comments panel.
 *
 * Rules followed:
 *  - No new backend changes
 *  - All existing APIs reused via plannerService
 *  - All existing permissions respected
 *  - Lazy-loaded sections (Attachments, Activity, History)
 *  - Memoised components to avoid unnecessary re-renders
 *  - Debounced autosave for notes
 *  - No heavy UI libraries — pure Tailwind + lucide-react
 *  - Dark mode compatible
 *  - Accessible: focus trap, ARIA labels, keyboard navigation
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
  memo,
} from 'react';
import {
  X,
  MoreHorizontal,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  FileText,
  Paperclip,
  Activity,
  Shield,
  Clock,
  User,
  Calendar,
  Flag,
  Hash,
  AlignLeft,
  Zap,
} from 'lucide-react';
import { plannerService } from '../../../services/plannerService';
import type { TaskDetail } from '../../../services/plannerService';
import { useAuth } from '../../../contexts/AuthContext';
import TaskInfoSection from './sections/TaskInfoSection';
import PeopleSection from './sections/PeopleSection';
import ChecklistSection from './sections/ChecklistSection';
import NotesSection from './sections/NotesSection';
import { PriorityBadge } from '../shared/PriorityBadge';
import { StatusBadge } from '../shared/StatusBadge';

// Lazy-loaded heavy sections
const AttachmentsSection = lazy(() => import('./sections/AttachmentsSection'));
const CommentsPanel = lazy(() => import('./sections/CommentsPanel'));
const ActivitySection = lazy(() => import('./sections/ActivitySection'));

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskDetailModalProps {
  isOpen: boolean;
  taskId: number | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

// ─── Section collapse state ───────────────────────────────────────────────────

const DEFAULT_SECTIONS: Record<string, boolean> = {
  info: true,
  people: true,
  checklist: true,
  notes: true,
  attachments: false,
  activity: false,
  history: false,
};

// ─── Avatar helper ────────────────────────────────────────────────────────────

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}

const Section = memo(function Section({
  title,
  icon,
  isOpen,
  onToggle,
  count,
  children,
}: SectionProps) {
  return (
    <div className="border-b border-gray-100 dark:border-neutral-800 last:border-0">
      {/* Section header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors duration-150 group text-left"
        aria-expanded={isOpen}
      >
        <span className="text-gray-400 dark:text-neutral-500 shrink-0 group-hover:text-gray-600 dark:group-hover:text-neutral-400 transition-colors">
          {icon}
        </span>
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400 group-hover:text-gray-700 dark:group-hover:text-neutral-300 transition-colors">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-medium text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded-full tabular-nums">
            {count}
          </span>
        )}
        <span className="text-gray-300 dark:text-neutral-600 shrink-0 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </button>

      {/* Section content */}
      {isOpen && (
        <div className="px-6 pb-5 animate-in fade-in slide-in-from-top-2 duration-150">
          {children}
        </div>
      )}
    </div>
  );
});

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const SectionSkeleton = memo(function SectionSkeleton() {
  return (
    <div className="px-6 py-4 space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-8 bg-gray-100 dark:bg-neutral-800 rounded-lg" />
      ))}
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function TaskDetailModal({
  isOpen,
  taskId,
  onClose,
  onTaskUpdated,
}: TaskDetailModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [sections, setSections] = useState<Record<string, boolean>>(DEFAULT_SECTIONS);
  const [menuOpen, setMenuOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ── Fetch task detail ────────────────────────────────────────────────────

  const fetchTask = useCallback(
    async (silent = false) => {
      if (!taskId) return;
      if (!silent) setIsLoading(true);
      try {
        const data = await plannerService.getTaskDetail(taskId);
        setTask(data);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [taskId]
  );

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTask();
    } else {
      // Reset state when closed
      if (!isOpen) {
        setTask(null);
        setMenuOpen(false);
      }
    }
  }, [isOpen, taskId, fetchTask]);

  // ── Keyboard handling ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen, isLoading]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTaskUpdated = useCallback(
    (updates?: Record<string, unknown>) => {
      if (updates) {
        setTask((prev) => (prev ? { ...prev, ...updates } : prev));
      }
      onTaskUpdated?.();
    },
    [onTaskUpdated]
  );

  const toggleSection = useCallback((id: string) => {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Formatting helpers ────────────────────────────────────────────────────

  const formatDate = (d: string | null | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue =
    task?.due_date &&
    task.status !== 'completed' &&
    new Date(task.due_date) < new Date(new Date().toDateString());

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div
          ref={modalRef}
          className="relative flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700/60 shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
          style={{
            width: '88vw',
            maxWidth: '1600px',
            height: '90vh',
          }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 shrink-0 z-10">
            {/* Title area */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              {isLoading && !task ? (
                <div className="h-5 w-64 bg-gray-200 dark:bg-neutral-700 rounded animate-pulse" />
              ) : (
                <>
                  <h2
                    id="task-modal-title"
                    className="text-sm font-semibold text-gray-900 dark:text-neutral-100 truncate max-w-[400px]"
                    title={task?.title}
                  >
                    {task?.title ?? 'Task Details'}
                  </h2>

                  {/* Quick status + priority badges in header */}
                  {task && (
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <StatusBadge status={task.status as 'pending' | 'in_progress' | 'completed'} />
                      {task.priority && (
                        <PriorityBadge priority={task.priority as 'low' | 'medium' | 'high'} />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Meta row */}
            {task && (
              <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 dark:text-neutral-500 shrink-0">
                {task.id && (
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {task.id}
                  </span>
                )}
                {task.created_at && (
                  <span className="flex items-center gap-1" title="Created">
                    <Clock className="w-3 h-3" />
                    {formatDate(task.created_at as string)}
                  </span>
                )}
                {task.due_date && (
                  <span
                    className={`flex items-center gap-1 ${
                      isOverdue
                        ? 'text-red-500 dark:text-red-400 font-medium'
                        : ''
                    }`}
                    title="Due date"
                  >
                    <Calendar className="w-3 h-3" />
                    {formatDate(task.due_date)}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Chat toggle */}
              <button
                onClick={() => setShowChat((p) => !p)}
                className={`p-1.5 rounded-lg transition-colors duration-150 ${
                  showChat
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300'
                }`}
                aria-label={showChat ? 'Hide chat' : 'Show chat'}
                title={showChat ? 'Hide chat panel' : 'Show chat panel'}
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((p) => !p)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors duration-150"
                  aria-label="More options"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && task && (
                  <MoreMenu
                    taskId={task.id}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
              </div>

              {/* Close */}
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors duration-150"
                aria-label="Close task details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* LEFT PANEL — scrollable sections */}
            <main
              className={`flex flex-col overflow-y-auto transition-all duration-200 ${
                showChat ? 'flex-[0_0_65%] border-r border-gray-100 dark:border-neutral-800' : 'flex-1'
              }`}
              aria-label="Task details"
            >
              {isLoading && !task ? (
                <>
                  <SectionSkeleton />
                  <SectionSkeleton />
                </>
              ) : !task ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-neutral-500">
                  <Zap className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Could not load task.</p>
                  <button
                    onClick={() => fetchTask()}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {/* § Task Information */}
                  <Section
                    id="info"
                    title="Task Information"
                    icon={<AlignLeft className="w-3.5 h-3.5" />}
                    isOpen={sections.info}
                    onToggle={() => toggleSection('info')}
                  >
                    <TaskInfoSection task={task} onUpdated={handleTaskUpdated} />
                  </Section>

                  {/* § People */}
                  <Section
                    id="people"
                    title="People"
                    icon={<User className="w-3.5 h-3.5" />}
                    isOpen={sections.people}
                    onToggle={() => toggleSection('people')}
                  >
                    <PeopleSection task={task} />
                  </Section>

                  {/* § Checklist */}
                  <Section
                    id="checklist"
                    title="Checklist"
                    icon={<CheckSquare className="w-3.5 h-3.5" />}
                    isOpen={sections.checklist}
                    onToggle={() => toggleSection('checklist')}
                    count={task.checklist?.length}
                  >
                    <ChecklistSection taskId={task.id} initialItems={task.checklist} />
                  </Section>

                  {/* § Notes */}
                  <Section
                    id="notes"
                    title="Notes"
                    icon={<FileText className="w-3.5 h-3.5" />}
                    isOpen={sections.notes}
                    onToggle={() => toggleSection('notes')}
                  >
                    <NotesSection taskId={task.id} />
                  </Section>

                  {/* § Attachments (lazy) */}
                  <Section
                    id="attachments"
                    title="Attachments"
                    icon={<Paperclip className="w-3.5 h-3.5" />}
                    isOpen={sections.attachments}
                    onToggle={() => toggleSection('attachments')}
                    count={task.attachment_count ?? 0}
                  >
                    {sections.attachments && (
                      <Suspense fallback={<SectionSkeleton />}>
                        <AttachmentsSection taskId={task.id} />
                      </Suspense>
                    )}
                  </Section>

                  {/* § Activity Timeline (lazy) */}
                  <Section
                    id="activity"
                    title="Activity"
                    icon={<Activity className="w-3.5 h-3.5" />}
                    isOpen={sections.activity}
                    onToggle={() => toggleSection('activity')}
                  >
                    {sections.activity && (
                      <Suspense fallback={<SectionSkeleton />}>
                        <ActivitySection taskId={task.id} />
                      </Suspense>
                    )}
                  </Section>

                  {/* § History (Admin only, lazy) */}
                  {isAdmin && (
                    <Section
                      id="history"
                      title="History"
                      icon={<Shield className="w-3.5 h-3.5" />}
                      isOpen={sections.history}
                      onToggle={() => toggleSection('history')}
                    >
                      {sections.history && (
                        <Suspense fallback={<SectionSkeleton />}>
                          <ActivitySection taskId={task.id} adminOnly />
                        </Suspense>
                      )}
                    </Section>
                  )}
                </>
              )}
            </main>

            {/* RIGHT PANEL — persistent chat/comments */}
            {showChat && (
              <aside
                className="flex flex-col flex-[0_0_35%] min-w-0 bg-gray-50/50 dark:bg-neutral-900/50"
                aria-label="Task comments"
              >
                {taskId ? (
                  <Suspense
                    fallback={
                      <div className="flex-1 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    }
                  >
                    <CommentsPanel taskId={taskId} currentUser={user} />
                  </Suspense>
                ) : null}
              </aside>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── More Menu ────────────────────────────────────────────────────────────────

interface MoreMenuProps {
  taskId: number;
  onClose: () => void;
}

const MoreMenu = memo(function MoreMenu({ taskId, onClose }: MoreMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/planner/task/${taskId}`).catch(() => {});
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-lg z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
      role="menu"
    >
      <button
        onClick={copyLink}
        className="w-full px-3.5 py-2.5 text-left text-sm text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors duration-100 flex items-center gap-2.5"
        role="menuitem"
      >
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        Copy link
      </button>
    </div>
  );
});
