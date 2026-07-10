import { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { plannerService, TaskCard } from '../../../services/plannerService';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: TaskCard;
}

interface CalendarViewProps {
  planId: number;
  onTaskClick: (taskId: number) => void;
  refreshKey?: number;
}

/**
 * Parse a date-only string "YYYY-MM-DD" into a local midnight Date,
 * avoiding the UTC off-by-one that `new Date("YYYY-MM-DD")` causes.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

export default function CalendarView({ planId, onTaskClick, refreshKey }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<string>(Views.MONTH);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const buckets = await plannerService.getBuckets(planId);
      const allTaskArrays = await Promise.all(
        buckets.map((b) => plannerService.getTasks(b.id))
      );
      const allTasks = allTaskArrays.flat().filter((t) => t.due_date != null);

      const calEvents: CalendarEvent[] = allTasks.map((task) => {
        // Use parseLocalDate to avoid UTC→local shift on date-only strings
        const date = parseLocalDate(task.due_date!.split('T')[0]);
        return {
          id: task.id,
          title: task.title,
          start: date,
          end: date,
          resource: task,
        };
      });
      setEvents(calEvents);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (refreshKey != null && refreshKey > 0) fetchData(true);
  }, [refreshKey, fetchData]);

  const handleEventDrop = useCallback(
    async ({ event, start }: { event: CalendarEvent; start: Date | string }) => {
      // Extract local YYYY-MM-DD to avoid UTC shift from toISOString()
      let newDate: string;
      if (typeof start === 'string') {
        newDate = start.split('T')[0];
      } else {
        const y = start.getFullYear();
        const m = String(start.getMonth() + 1).padStart(2, '0');
        const d = String(start.getDate()).padStart(2, '0');
        newDate = `${y}-${m}-${d}`;
      }
      // Optimistic update
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? { ...e, start: parseLocalDate(newDate), end: parseLocalDate(newDate) }
            : e
        )
      );
      try {
        await plannerService.updateTask(event.id, { due_date: newDate });
      } catch {
        // Rollback on error
        await fetchData();
      }
    },
    [fetchData]
  );

  const eventStyleGetter = (event: CalendarEvent) => {
    const priority = event.resource.priority ?? 'medium';
    const bg = PRIORITY_COLOURS[priority] ?? '#6B7280';
    return {
      style: {
        backgroundColor: bg,
        borderRadius: '6px',
        border: 'none',
        color: '#fff',
        fontSize: '12px',
        padding: '1px 6px',
      },
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
      <DnDCalendar
        localizer={localizer}
        events={events}
        view={currentView as any}
        onView={(v: string) => setCurrentView(v)}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        onSelectEvent={(event: CalendarEvent) => onTaskClick(event.id)}
        onEventDrop={handleEventDrop as any}
        eventPropGetter={eventStyleGetter as any}
        draggableAccessor={() => true}
        resizable={false}
        style={{ height: '100%' }}
        popup
        showAllEvents
      />
    </div>
  );
}
