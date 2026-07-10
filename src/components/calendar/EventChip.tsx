import { memo } from 'react';
import type { CalendarItem } from './constants';
import { formatTime } from './constants';

interface EventChipProps {
  item: CalendarItem;
  compact?: boolean;
  draggable?: boolean;
  onClick?: (item: CalendarItem) => void;
  onDragStart?: (item: CalendarItem, e: React.DragEvent) => void;
}

function EventChipInner({ item, compact = false, draggable = false, onClick, onDragStart }: EventChipProps) {
  const { colours } = item;
  const isCompleted = colours.completed || item.status === 'completed';

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        if (draggable) {
          e.dataTransfer.effectAllowed = 'move';
        }
        onDragStart?.(item, e);
      }}
      onClick={(e) => { e.stopPropagation(); onClick?.(item); }}
      className={`
        w-full text-left rounded-md truncate transition-all duration-100
        hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/50
        ${compact ? 'text-[10px] leading-snug px-1.5 py-px' : 'text-xs px-2 py-1'}
      `}
      style={{
        backgroundColor: colours.bg,
        borderLeft: `2.5px solid ${colours.priorityBorder || colours.border}`,
        color: '#fff',
        textDecoration: isCompleted ? 'line-through' : 'none',
        opacity: isCompleted ? 0.65 : 1,
      }}
      title={item.title}
    >
      {!item.all_day && item.start_time && compact && (
        <span className="opacity-75 mr-1 font-normal">{formatTime(item.start_time)}</span>
      )}
      <span className={compact ? '' : 'font-medium'}>{item.title}</span>
    </button>
  );
}

export default memo(EventChipInner);
