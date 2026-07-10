import { memo, useMemo, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import EventChip from '../EventChip';
import type { CalendarItem } from '../constants';
import { toDateKey } from '../constants';

interface MonthViewProps {
  currentDate: Date;
  itemsByDate: Map<string, CalendarItem[]>;
  onDayClick: (date: Date) => void;
  onItemClick: (item: CalendarItem) => void;
  onMoreClick: (date: Date) => void;
  onNewEvent?: (date: Date) => void;
  onNewNote?: (date: Date) => void;
  onItemDrop?: (item: CalendarItem, targetDate: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MonthViewInner({
  currentDate,
  itemsByDate,
  onDayClick,
  onItemClick,
  onMoreClick,
  onNewEvent,
  onItemDrop,
}: MonthViewProps) {
  const today = toDateKey(new Date());
  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      cells.push({ date: d, isCurrentMonth: false, key: toDateKey(d) });
    }
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      cells.push({ date: d, isCurrentMonth: true, key: toDateKey(d) });
    }
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      cells.push({ date: d, isCurrentMonth: false, key: toDateKey(d) });
    }

    const result: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [currentDate]);

  const handleDragOver = useCallback((e: React.DragEvent, key: string) => {
    e.preventDefault();
    setDragOverKey(key);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, date: Date, key: string) => {
    e.preventDefault();
    setDragOverKey(null);
    if (dragItem && onItemDrop) onItemDrop(dragItem, date);
    setDragItem(null);
  }, [dragItem, onItemDrop]);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-widest"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid min-h-0 bg-white dark:bg-neutral-900" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 min-h-0 border-b border-gray-100 dark:border-neutral-800 last:border-b-0">
            {week.map(({ date, isCurrentMonth, key }) => {
              const dayItems = itemsByDate.get(key) ?? [];
              const isToday = key === today;
              const isDragOver = dragOverKey === key;
              const isHovered = hoveredKey === key;

              return (
                <div
                  key={key}
                  className={`
                    relative border-r border-gray-100 dark:border-neutral-800 last:border-r-0
                    flex flex-col min-h-0 overflow-hidden cursor-pointer
                    transition-colors duration-100
                    ${isCurrentMonth ? 'bg-white dark:bg-neutral-900' : 'bg-gray-50/60 dark:bg-neutral-950/60'}
                    ${isDragOver ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/30 dark:bg-blue-900/20' : ''}
                    ${isHovered && !isDragOver ? 'bg-gray-50 dark:bg-neutral-800/40' : ''}
                  `}
                  onClick={() => onDayClick(date)}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(e) => handleDrop(e, date, key)}
                >
                  {/* Date number row */}
                  <div className="flex items-center justify-between px-1.5 pt-1 pb-0.5 shrink-0">
                    <span
                      className={`
                        text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium select-none
                        ${isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : isCurrentMonth
                            ? 'text-gray-800 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700'
                            : 'text-gray-400 dark:text-neutral-600'
                        }
                      `}
                    >
                      {date.getDate()}
                    </span>
                    {/* Plus button on hover */}
                    {isHovered && onNewEvent && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onNewEvent(date); }}
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                        title="Add event"
                      >
                        <Plus size={11} />
                      </button>
                    )}
                  </div>

                  {/* Events — scrollable when items overflow the cell */}
                  <div
                    className="flex-1 px-0.5 pb-0.5 space-y-0.5 overflow-y-auto min-h-0 cal-day-scroll"
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {dayItems.map((item) => (
                      <EventChip
                        key={item.id}
                        item={item}
                        compact
                        draggable={!!onItemDrop}
                        onClick={(it) => { onItemClick(it); }}
                        onDragStart={(it) => setDragItem(it)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(MonthViewInner);
