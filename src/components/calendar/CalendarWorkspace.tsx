import { useState, useCallback } from 'react';
import { useCalendar } from '../../hooks/useCalendar';
import { useTaskDrawer } from '../../hooks/useTaskDrawer';
import CalendarHeader from './CalendarHeader';
import MonthView from './views/MonthView';
import WeekView from './views/WeekView';
import DayView from './views/DayView';
import AgendaView from './views/AgendaView';
import DayPanel from './DayPanel';
import EventDrawer from './EventDrawer';
import NoteDrawer from './NoteDrawer';
import CreateTaskPanel from './CreateTaskPanel';
import TaskDrawer from '../planner/drawer/TaskDrawer';
import type { CalendarItem } from './constants';
import { toDateKey, parseDateKey } from './constants';

export default function CalendarWorkspace({ hideHeader = false }: { hideHeader?: boolean }) {
  const {
    viewMode,
    setViewMode,
    currentDate,
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
  } = useCalendar();

  const { isOpen: taskDrawerOpen, activeTaskId, activeTab, openTask, closeDrawer, setActiveTab } = useTaskDrawer();

  const [dayPanelDate, setDayPanelDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [eventDrawer, setEventDrawer] = useState<{ open: boolean; date: Date | null; eventId?: number }>({ open: false, date: null });
  const [noteDrawer, setNoteDrawer] = useState<{ open: boolean; date: Date | null; noteId?: number }>({ open: false, date: null });
  const [taskPanel, setTaskPanel] = useState<{ open: boolean; date: Date | null }>({ open: false, date: null });

  const handleItemClick = useCallback((item: CalendarItem) => {
    if (item.source === 'planner_task' && item.planner_task_id) {
      openTask(item.planner_task_id);
    } else if (item.source === 'calendar_event' && item.event_id) {
      setEventDrawer({ open: true, date: parseDateKey(item.event_date.split('T')[0]), eventId: item.event_id });
    } else if (item.source === 'calendar_note' && item.note_id) {
      setNoteDrawer({ open: true, date: parseDateKey(item.event_date.split('T')[0]), noteId: item.note_id });
    }
  }, [openTask]);

  const handleDayClick = useCallback((date: Date) => {
    setDayPanelDate(date);
  }, []);

  const handleSlotClick = useCallback((date: Date, _hour: number) => {
    setEventDrawer({ open: true, date });
  }, []);

  const dayPanelItems = dayPanelDate ? getItemsForDate(dayPanelDate) : [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-neutral-950">
      {!hideHeader && (
        <CalendarHeader
          currentDate={currentDate}
          viewMode={viewMode}
          onViewChange={setViewMode}
          onNavigate={navigate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          onNewEvent={() => setEventDrawer({ open: true, date: currentDate })}
          onNewNote={() => setNoteDrawer({ open: true, date: currentDate })}
          onNewTask={() => setTaskPanel({ open: true, date: currentDate })}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters((v) => !v)}
        />
      )}

      {error && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        ) : (
          <>
            {viewMode === 'month' && (
              <MonthView
                currentDate={currentDate}
                itemsByDate={itemsByDate}
                onDayClick={handleDayClick}
                onItemClick={handleItemClick}
                onMoreClick={handleDayClick}
                onNewEvent={(d) => setEventDrawer({ open: true, date: d })}
                onNewNote={(d) => setNoteDrawer({ open: true, date: d })}
                onItemDrop={(item, date) => moveItem(item, toDateKey(date))}
              />
            )}
            {viewMode === 'week' && (
              <WeekView
                currentDate={currentDate}
                itemsByDate={itemsByDate}
                onDayClick={handleDayClick}
                onItemClick={handleItemClick}
                onSlotClick={handleSlotClick}
              />
            )}
            {viewMode === 'day' && (
              <DayView
                currentDate={currentDate}
                items={getItemsForDate(currentDate)}
                onItemClick={handleItemClick}
                onSlotClick={handleSlotClick}
              />
            )}
            {viewMode === 'agenda' && (
              <AgendaView
                items={items}
                onItemClick={handleItemClick}
                onDayClick={handleDayClick}
              />
            )}
          </>
        )}
      </div>

      {/* Day panel */}
      <DayPanel
        date={dayPanelDate}
        items={dayPanelItems}
        onClose={() => setDayPanelDate(null)}
        onItemClick={(item) => { setDayPanelDate(null); handleItemClick(item); }}
        onNewEvent={(d) => { setDayPanelDate(null); setEventDrawer({ open: true, date: d }); }}
        onNewNote={(d) => { setDayPanelDate(null); setNoteDrawer({ open: true, date: d }); }}
        onNewTask={(d) => { setDayPanelDate(null); setTaskPanel({ open: true, date: d }); }}
      />

      {/* Side drawers */}
      <EventDrawer
        isOpen={eventDrawer.open}
        date={eventDrawer.date}
        eventId={eventDrawer.eventId}
        onClose={() => setEventDrawer({ open: false, date: null })}
        onSaved={() => fetchItems(true)}
      />
      <NoteDrawer
        isOpen={noteDrawer.open}
        date={noteDrawer.date}
        noteId={noteDrawer.noteId}
        onClose={() => setNoteDrawer({ open: false, date: null })}
        onSaved={() => fetchItems(true)}
      />
      <CreateTaskPanel
        isOpen={taskPanel.open}
        date={taskPanel.date}
        onClose={() => setTaskPanel({ open: false, date: null })}
        onCreated={(taskId) => { fetchItems(true); openTask(taskId); }}
      />

      {/* Planner task drawer — reuses existing component */}
      <TaskDrawer
        isOpen={taskDrawerOpen}
        taskId={activeTaskId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={closeDrawer}
        onTaskUpdated={() => fetchItems(true)}
      />
    </div>
  );
}
