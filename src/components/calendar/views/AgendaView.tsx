import { memo } from 'react';
import type { CalendarItem } from '../constants';
import { formatTime, EVENT_TYPE_LABELS, toDateKey } from '../constants';
import { Clock, MapPin, FileText, CheckSquare, Calendar } from 'lucide-react';

interface AgendaViewProps {
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onDayClick: (date: Date) => void;
}

interface DayGroup {
  date: string;
  items: CalendarItem[];
}

function groupByDate(items: CalendarItem[]): DayGroup[] {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = item.event_date.split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayItems]) => ({ date, items: dayItems }));
}

function getItemIcon(type: CalendarItem['type']) {
  switch (type) {
    case 'planner_task': return <CheckSquare size={13} className="shrink-0" />;
    case 'note': return <FileText size={13} className="shrink-0" />;
    default: return <Calendar size={13} className="shrink-0" />;
  }
}

function AgendaViewInner({ items, onItemClick, onDayClick }: AgendaViewProps) {
  const groups = groupByDate(items);
  const today = toDateKey(new Date());

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-neutral-500 gap-2">
        <Calendar size={40} strokeWidth={1} />
        <p className="text-sm">No events in this period</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-neutral-900">
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-0">
        {groups.map(({ date, items: dayItems }) => {
          const dateObj = new Date(date + 'T00:00:00');
          const isToday = date === today;
          const isPast = date < today;

          const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          const monthDay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          const year = dateObj.getFullYear();
          const currentYear = new Date().getFullYear();

          return (
            <div key={date} className="flex gap-0 group">
              {/* Date column */}
              <button
                onClick={() => onDayClick(dateObj)}
                className={`w-24 shrink-0 flex flex-col items-end pr-4 pt-3 pb-2 hover:opacity-80 transition-opacity ${
                  isPast ? 'opacity-50' : ''
                }`}
              >
                <span
                  className={`text-3xl font-light leading-none ${
                    isToday ? 'text-blue-600 font-semibold' : 'text-gray-800 dark:text-neutral-200'
                  }`}
                >
                  {dateObj.getDate()}
                </span>
                <span className={`text-[11px] font-medium mt-0.5 ${isToday ? 'text-blue-600' : 'text-gray-400 dark:text-neutral-500'}`}>
                  {dayLabel.substring(0, 3).toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-300 dark:text-neutral-600 mt-0.5">
                  {dateObj.toLocaleDateString('en-US', { month: 'short' })}{year !== currentYear ? ` ${year}` : ''}
                </span>
              </button>

              {/* Divider */}
              <div className="flex flex-col items-center mr-4">
                <div className={`mt-4 w-2.5 h-2.5 rounded-full border-2 ${isToday ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-600'}`} />
                <div className="flex-1 w-px bg-gray-150 dark:bg-neutral-800 mt-1" style={{ backgroundColor: 'rgb(229 231 235)' }} />
              </div>

              {/* Events column */}
              <div className="flex-1 pt-2 pb-3 space-y-1.5 min-w-0">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onItemClick(item)}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-all duration-100 group/item"
                    style={{ borderLeftColor: item.colours.border, borderLeftWidth: 3 }}
                  >
                    {/* Color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: item.colours.dot }}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        item.status === 'completed'
                          ? 'line-through text-gray-400 dark:text-neutral-500'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {item.title}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-neutral-500">
                          {getItemIcon(item.type)}
                          {EVENT_TYPE_LABELS[item.type] ?? item.type}
                        </span>
                        {!item.all_day && item.start_time && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-neutral-500">
                            <Clock size={11} />
                            {formatTime(item.start_time)}
                            {item.end_time && ` – ${formatTime(item.end_time)}`}
                          </span>
                        )}
                        {item.all_day && (
                          <span className="text-[11px] text-gray-400 dark:text-neutral-500">All day</span>
                        )}
                        {item.location && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-neutral-500 truncate">
                            <MapPin size={11} />
                            {item.location}
                          </span>
                        )}
                        {item.plan_name && (
                          <span className="text-[11px] text-blue-500 truncate">{item.plan_name}</span>
                        )}
                      </div>
                    </div>

                    {/* Priority badge */}
                    {item.priority === 'high' && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium">
                        High
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}

export default memo(AgendaViewInner);
