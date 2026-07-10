import { memo } from 'react';
import { X, Plus, Clock, MapPin } from 'lucide-react';
import type { CalendarItem } from './constants';
import { EVENT_TYPE_LABELS, formatTime } from './constants';

interface DayPanelProps {
  date: Date | null;
  items: CalendarItem[];
  onClose: () => void;
  onItemClick: (item: CalendarItem) => void;
  onNewEvent: (date: Date) => void;
  onNewNote: (date: Date) => void;
  onNewTask: (date: Date) => void;
}

function sortByTime(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => {
    if (a.all_day && !b.all_day) return -1;
    if (!a.all_day && b.all_day) return 1;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });
}

function DayPanelInner({
  date,
  items,
  onClose,
  onItemClick,
  onNewEvent,
  onNewNote,
  onNewTask,
}: DayPanelProps) {
  if (!date) return null;

  const sorted = sortByTime(items);
  const title = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const grouped = {
    tasks: sorted.filter((i) => i.type === 'planner_task'),
    meetings: sorted.filter((i) => i.type === 'meeting'),
    notes: sorted.filter((i) => i.type === 'note'),
    deadlines: sorted.filter((i) => i.type === 'deadline'),
    followUps: sorted.filter((i) => i.type === 'follow_up'),
    other: sorted.filter((i) => !['planner_task', 'meeting', 'note', 'deadline', 'follow_up'].includes(i.type)),
  };

  const sections = [
    { key: 'tasks', label: 'Tasks', items: grouped.tasks },
    { key: 'meetings', label: 'Meetings', items: grouped.meetings },
    { key: 'notes', label: 'Notes', items: grouped.notes },
    { key: 'deadlines', label: 'Deadlines', items: grouped.deadlines },
    { key: 'followUps', label: 'Follow-ups', items: grouped.followUps },
    { key: 'other', label: 'Other', items: grouped.other },
  ].filter((s) => s.items.length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-neutral-800 animate-in slide-in-from-right duration-150">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 px-4 py-2 border-b border-gray-100 dark:border-neutral-800 shrink-0">
          <button
            onClick={() => onNewEvent(date)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 transition-colors duration-100"
          >
            <Plus size={12} /> Event
          </button>
          <button
            onClick={() => onNewNote(date)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 hover:bg-purple-100 transition-colors duration-100"
          >
            <Plus size={12} /> Note
          </button>
          <button
            onClick={() => onNewTask(date)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 transition-colors duration-100"
          >
            <Plus size={12} /> Task
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {sections.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nothing scheduled for this day</p>
          ) : (
            sections.map(({ key, label, items: sectionItems }) => (
              <section key={key}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h3>
                <div className="space-y-2">
                  {sectionItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onItemClick(item)}
                      className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-neutral-800 hover:border-gray-200 dark:hover:border-neutral-700 hover:shadow-sm transition-all duration-100"
                      style={{ borderLeftColor: item.colours.border, borderLeftWidth: 3 }}
                    >
                      <div className={`font-medium text-sm ${item.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{EVENT_TYPE_LABELS[item.type]}</span>
                        {!item.all_day && item.start_time && (
                          <span className="flex items-center gap-0.5">
                            <Clock size={10} /> {formatTime(item.start_time)}
                          </span>
                        )}
                        {item.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} /> {item.location}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

export default memo(DayPanelInner);
