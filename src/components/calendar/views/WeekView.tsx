import { memo, useMemo, useEffect, useRef, useState } from 'react';
import EventChip from '../EventChip';
import type { CalendarItem } from '../constants';
import { toDateKey, formatTime } from '../constants';

interface WeekViewProps {
  currentDate: Date;
  itemsByDate: Map<string, CalendarItem[]>;
  onDayClick: (date: Date) => void;
  onItemClick: (item: CalendarItem) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 56; // px per hour
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function getCurrentTimeTop(): number {
  const now = new Date();
  return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
}

function WeekViewInner({ currentDate, itemsByDate, onDayClick, onItemClick, onSlotClick }: WeekViewProps) {
  const today = toDateKey(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState(getCurrentTimeTop);
  const [hoveredSlot, setHoveredSlot] = useState<{ key: string; hour: number } | null>(null);

  const days = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = Math.max(0, getCurrentTimeTop() - 120);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  // Update now line every minute
  useEffect(() => {
    const interval = setInterval(() => setNowTop(getCurrentTimeTop()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const todayIsInWeek = days.some((d) => toDateKey(d) === today);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-neutral-900">
      {/* Day headers */}
      <div className="flex shrink-0 border-b border-gray-200 dark:border-neutral-800">
        {/* Time gutter spacer */}
        <div className="w-16 shrink-0" />
        {days.map((date) => {
          const key = toDateKey(date);
          const isToday = key === today;
          const allDayItems = (itemsByDate.get(key) ?? []).filter((i) => i.all_day);
          return (
            <div
              key={key}
              className={`flex-1 border-l border-gray-100 dark:border-neutral-800 first:border-l-0 min-w-0 ${isToday ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
            >
              <button
                onClick={() => onDayClick(date)}
                className="w-full flex flex-col items-center py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <span className={`text-[11px] uppercase tracking-wide font-medium ${isToday ? 'text-blue-600' : 'text-gray-400 dark:text-neutral-500'}`}>
                  {WEEKDAYS_SHORT[date.getDay()]}
                </span>
                <span
                  className={`mt-0.5 text-xl font-light w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                    isToday
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-800 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  {date.getDate()}
                </span>
              </button>
              {/* All-day events */}
              {allDayItems.length > 0 && (
                <div className="px-0.5 pb-1 space-y-0.5 min-h-0">
                  {allDayItems.map((item) => (
                    <EventChip key={item.id} item={item} compact onClick={onItemClick} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ minHeight: `${HOUR_HEIGHT * 24}px` }}>
          {/* Time gutter */}
          <div className="w-16 shrink-0 relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: `${h * HOUR_HEIGHT - 8}px`, height: `${HOUR_HEIGHT}px` }}
              >
                {h !== 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-medium">{formatHour(h)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid min-w-0" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
            {days.map((date) => {
              const key = toDateKey(date);
              const isToday = key === today;
              const dayItems = itemsByDate.get(key) ?? [];
              const timed = dayItems.filter((i) => !i.all_day && i.start_time);

              return (
                <div
                  key={key}
                  className={`relative border-l border-gray-100 dark:border-neutral-800 first:border-l-0 ${
                    isToday ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''
                  }`}
                >
                  {/* Hour slots */}
                  {HOURS.map((h) => {
                    const isHovered = hoveredSlot?.key === key && hoveredSlot.hour === h;
                    return (
                      <div
                        key={h}
                        onClick={() => onSlotClick(date, h)}
                        onMouseEnter={() => setHoveredSlot({ key, hour: h })}
                        onMouseLeave={() => setHoveredSlot(null)}
                        className={`border-b border-gray-50 dark:border-neutral-800/60 cursor-pointer transition-colors duration-75 ${
                          isHovered ? 'bg-blue-50/60 dark:bg-blue-900/15' : ''
                        }`}
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      />
                    );
                  })}

                  {/* Timed events */}
                  {timed.map((item) => {
                    const [hh, mm] = (item.start_time || '09:00:00').split(':').map(Number);
                    const top = (hh + mm / 60) * HOUR_HEIGHT;
                    const endTime = item.end_time;
                    let height = HOUR_HEIGHT; // default 1 hr
                    if (endTime) {
                      const [eh, em] = endTime.split(':').map(Number);
                      const endMins = eh * 60 + em;
                      const startMins = hh * 60 + mm;
                      height = Math.max(24, ((endMins - startMins) / 60) * HOUR_HEIGHT);
                    }
                    return (
                      <div
                        key={item.id}
                        className="absolute left-0.5 right-0.5 rounded-md overflow-hidden cursor-pointer z-10 shadow-sm hover:shadow-md transition-shadow"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: item.colours.bg,
                          borderLeft: `3px solid ${item.colours.border}`,
                        }}
                        onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                        title={`${formatTime(item.start_time)} ${item.title}`}
                      >
                        <div className="px-1 pt-0.5">
                          <div className="text-[10px] text-white font-semibold truncate leading-tight">{item.title}</div>
                          {height > 30 && (
                            <div className="text-[9px] text-white/80 truncate">{formatTime(item.start_time)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Current time indicator */}
                  {isToday && todayIsInWeek && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: `${nowTop}px` }}
                    >
                      <div className="relative flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                        <div className="flex-1 h-px bg-red-500" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(WeekViewInner);
