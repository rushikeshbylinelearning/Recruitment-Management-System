import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { calendarService } from '../../services/calendarService';
import { REMINDER_OPTIONS, toDateKey } from './constants';

interface EventDrawerProps {
  isOpen: boolean;
  date: Date | null;
  eventId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EventDrawer({ isOpen, date, eventId, onClose, onSaved }: EventDrawerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState('meeting');
  const [location, setLocation] = useState('');
  const [reminderType, setReminderType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (eventId) {
      calendarService.getEvent(eventId).then((ev) => {
        setTitle(ev.title);
        setDescription(ev.description || '');
        setEventDate(ev.event_date?.split('T')[0] || '');
        setStartTime(ev.start_time?.slice(0, 5) || '');
        setEndTime(ev.end_time?.slice(0, 5) || '');
        setAllDay(!!ev.all_day);
        setCategory(ev.category_slug || 'custom');
        setLocation(ev.location || '');
      }).catch(() => setError('Failed to load event'));
    } else {
      setTitle('');
      setDescription('');
      setEventDate(date ? toDateKey(date) : toDateKey(new Date()));
      setStartTime('09:00');
      setEndTime('10:00');
      setAllDay(false);
      setCategory('meeting');
      setLocation('');
      setReminderType('');
      setError('');
    }
  }, [isOpen, eventId, date]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        description,
        event_date: eventDate,
        start_time: allDay ? undefined : startTime,
        end_time: allDay ? undefined : endTime,
        all_day: allDay,
        category,
        location: location || undefined,
        reminder_type: reminderType || undefined,
      };
      if (eventId) {
        await calendarService.updateEvent(eventId, payload);
      } else {
        await calendarService.createEvent(payload);
      }
      onSaved();
      onClose();
    } catch {
      setError('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-neutral-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="font-semibold">{eventId ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
          <div>
            <label className="text-xs font-medium text-gray-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Date</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                {['meeting', 'deadline', 'reminder', 'follow_up', 'interview', 'holiday', 'leave', 'birthday', 'custom'].map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
            All day
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Start</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">End</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Reminder</label>
            <select value={reminderType} onChange={(e) => setReminderType(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
              <option value="">None</option>
              {REMINDER_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </aside>
    </>
  );
}
