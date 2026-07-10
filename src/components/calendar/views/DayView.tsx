import { memo, useEffect, useRef, useState } from 'react';
import EventChip from '../EventChip';
import type { CalendarItem } from '../constants';
import { formatTime, toDateKey } from '../constants';

interface DayViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 64; // px per hour

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

function DayViewInner({ currentDate, items, onItemClick, onSlotClick }: DayViewProps) {
  const isToday = toDateKey(currentDate) === toDateKey(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState(getCurrentTimeTop);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const allDay = items.filter((i) => i.all_day);
  const timed = items.filter((i) => !i.all_day && i.start_time);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = Math.max(0, getCurrentTimeTop() - 150);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNowTop(getCurrentTimeTop()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-neutral-900">
      {/* Day header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-light shrink-0 ${
            isToday ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-neutral-200'
          }`}
        >
          {currentDate.getDate()}
        </div>
        <div>
          <div className={`text-base font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
            {formattedDate}
          </div>
          <div className="text-xs text-gray-400 dark:text-neutral-500">
            {items.length === 0 ? 'Nothing scheduled' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-gray-100 dark:border-neutral-800 space-y-1">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">All day</div>
          {allDay.map((item) => (
            <EventChip key={item.id} item={item} onClick={onItemClick} />
          ))}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ minHeight: `${HOUR_HEIGHT * 24}px` }}>
          {/* Time gutter */}
          <div className="w-16 shrink-0 relative select-none">
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

          {/* Day column */}
          <div className="flex-1 relative border-l border-gray-100 dark:border-neutral-800">
            {/* Hour slots */}
            {HOURS.map((h) => (
              <div
                key={h}
                onClick={() => onSlotClick(currentDate, h)}
                onMouseEnter={() => setHoveredHour(h)}
                onMouseLeave={() => setHoveredHour(null)}
                className={`border-b border-gray-50 dark:border-neutral-800/60 cursor-pointer transition-colors duration-75 ${
                  hoveredHour === h ? 'bg-blue-50/60 dark:bg-blue-900/15' : ''
                }`}
                style={{ height: `${HOUR_HEIGHT}px` }}
              />
            ))}

            {/* Timed events */}
            {timed.map((item) => {
              const [hh, mm] = (item.start_time || '09:00:00').split(':').map(Number);
              const top = (hh + mm / 60) * HOUR_HEIGHT;
              let height = HOUR_HEIGHT;
              if (item.end_time) {
                const [eh, em] = item.end_time.split(':').map(Number);
                const diff = (eh * 60 + em) - (hh * 60 + mm);
                height = Math.max(32, (diff / 60) * HOUR_HEIGHT);
              }
              return (
                <div
                  key={item.id}
                  className="absolute left-2 right-2 rounded-lg px-3 py-1.5 cursor-pointer z-10 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  style={{
                    top: `${top + 1}px`,
                    height: `${height - 2}px`,
                    backgroundColor: item.colours.bg,
                    borderLeft: `4px solid ${item.colours.border}`,
                  }}
                  onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                >
                  <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                  {height > 40 && (
                    <div className="text-xs text-white/75 mt-0.5">
                      {formatTime(item.start_time)}
                      {item.end_time && ` – ${formatTime(item.end_time)}`}
                    </div>
                  )}
                  {height > 60 && item.description && (
                    <div className="text-xs text-white/60 mt-1 line-clamp-2">{item.description}</div>
                  )}
                </div>
              );
            })}

            {/* Current time indicator */}
            {isToday && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: `${nowTop}px` }}
              >
                <div className="relative flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shrink-0 shadow" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(DayViewInner);

export function getDayItemsKey(date: Date) {
  return toDateKey(date);
}
