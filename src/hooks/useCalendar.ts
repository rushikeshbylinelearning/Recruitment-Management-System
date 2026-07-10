import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { calendarService, CalendarFilters } from '../services/calendarService';
import {
  CalendarItem,
  CalendarViewMode,
  toDateKey,
  getMonthRange,
  getWeekRange,
  getDayRange,
  getAgendaRange,
} from '../components/calendar/constants';
import { useDebounce } from './useDebounce';
import { plannerService } from '../services/plannerService';

function getRangeForView(view: CalendarViewMode, currentDate: Date) {
  switch (view) {
    case 'week': return getWeekRange(currentDate);
    case 'day': return getDayRange(currentDate);
    case 'agenda': return getAgendaRange(currentDate);
    default: return getMonthRange(currentDate);
  }
}

export function useCalendar() {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    return (localStorage.getItem('calendar_view_mode') as CalendarViewMode) || 'month';
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CalendarFilters>({ showCompleted: true });
  const debouncedSearch = useDebounce(searchQuery, 300);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem('calendar_view_mode', viewMode);
  }, [viewMode]);

  const dateRange = useMemo(
    () => getRangeForView(viewMode, currentDate),
    [viewMode, currentDate]
  );

  const fetchItems = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!silent) setIsLoading(true);
      setError(null);

      const params: CalendarFilters = {
        ...filters,
        q: debouncedSearch || undefined,
      };

      const data = await calendarService.getItems(dateRange.start, dateRange.end, params);
      if (!controller.signal.aborted) {
        setItems(data);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError('Failed to load calendar items');
      }
    } finally {
      if (!controller.signal.aborted && !silent) {
        setIsLoading(false);
      }
    }
  }, [dateRange, filters, debouncedSearch]);

  useEffect(() => {
    fetchItems();
    return () => abortRef.current?.abort();
  }, [fetchItems]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = item.event_date.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const navigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }
    setCurrentDate((prev) => {
      const d = new Date(prev);
      const delta = direction === 'prev' ? -1 : 1;
      if (viewMode === 'month') d.setMonth(d.getMonth() + delta);
      else if (viewMode === 'week') d.setDate(d.getDate() + delta * 7);
      else d.setDate(d.getDate() + delta);
      return d;
    });
  }, [viewMode]);

  const moveTaskDueDate = useCallback(async (taskId: number, newDate: string) => {
    const itemId = `task-${taskId}`;
    const prevItems = items;

    setItems((prev) =>
      prev.map((item) =>
        item.planner_task_id === taskId
          ? { ...item, event_date: newDate }
          : item
      )
    );

    try {
      await plannerService.updateTask(taskId, { due_date: newDate });
      await fetchItems(true);
    } catch {
      setItems(prevItems);
      throw new Error('Failed to move task');
    }
  }, [items, fetchItems]);

  const moveEventDate = useCallback(async (eventId: number, newDate: string) => {
    const prevItems = items;
    setItems((prev) =>
      prev.map((item) =>
        item.event_id === eventId
          ? { ...item, event_date: newDate }
          : item
      )
    );

    try {
      await calendarService.updateEvent(eventId, { event_date: newDate });
      await fetchItems(true);
    } catch {
      setItems(prevItems);
      throw new Error('Failed to move event');
    }
  }, [items, fetchItems]);

  const moveNoteDate = useCallback(async (noteId: number, newDate: string) => {
    const prevItems = items;
    setItems((prev) =>
      prev.map((item) =>
        item.note_id === noteId
          ? { ...item, event_date: newDate }
          : item
      )
    );

    try {
      await calendarService.updateNote(noteId, { note_date: newDate });
      await fetchItems(true);
    } catch {
      setItems(prevItems);
      throw new Error('Failed to move note');
    }
  }, [items, fetchItems]);

  const moveItem = useCallback(async (item: CalendarItem, newDate: string) => {
    if (item.source === 'planner_task' && item.planner_task_id) {
      await moveTaskDueDate(item.planner_task_id, newDate);
    } else if (item.source === 'calendar_event' && item.event_id) {
      await moveEventDate(item.event_id, newDate);
    } else if (item.source === 'calendar_note' && item.note_id) {
      await moveNoteDate(item.note_id, newDate);
    }
  }, [moveTaskDueDate, moveEventDate, moveNoteDate]);

  const getItemsForDate = useCallback(
    (date: Date) => itemsByDate.get(toDateKey(date)) ?? [],
    [itemsByDate]
  );

  return {
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    items,
    itemsByDate,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    navigate,
    fetchItems,
    moveItem,
    getItemsForDate,
    dateRange,
  };
}
