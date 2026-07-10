import { useState, useEffect } from 'react';
import { X, Pin } from 'lucide-react';
import { calendarService } from '../../services/calendarService';
import { REMINDER_OPTIONS, toDateKey } from './constants';

interface NoteDrawerProps {
  isOpen: boolean;
  date: Date | null;
  noteId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function NoteDrawer({ isOpen, date, noteId, onClose, onSaved }: NoteDrawerProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [colour, setColour] = useState('#8B5CF6');
  const [isPinned, setIsPinned] = useState(false);
  const [reminderType, setReminderType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (noteId) {
      calendarService.getNote(noteId).then((n) => {
        setTitle(n.title);
        setContent(n.note_content || '');
        setNoteDate(n.note_date?.split('T')[0] || '');
        setColour(n.colour || '#8B5CF6');
        setIsPinned(!!n.is_pinned);
        setReminderType('');
        setError('');
      }).catch(() => setError('Failed to load note'));
    } else {
      setTitle('');
      setContent('');
      setNoteDate(date ? toDateKey(date) : toDateKey(new Date()));
      setColour('#8B5CF6');
      setIsPinned(false);
      setReminderType('');
      setError('');
    }
  }, [isOpen, noteId, date]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        note_content: content,
        note_date: noteDate,
        colour,
        is_pinned: isPinned,
        reminder_type: reminderType || undefined,
      };
      if (noteId) {
        await calendarService.updateNote(noteId, payload);
      } else {
        await calendarService.createNote(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save note';
      setError(message);
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
          <h2 className="font-semibold">{noteId ? 'Edit Note' : 'Quick Note'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div>
            <label className="text-xs font-medium text-gray-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call HR, collect documents…" className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Note</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Add details…" className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Date</label>
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Colour</label>
              <input type="color" value={colour} onChange={(e) => setColour(e.target.value)} className="w-full mt-1 h-9 rounded-lg border border-gray-200 dark:border-neutral-700 cursor-pointer" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded" />
            <Pin size={14} /> Pin to Planner Dashboard
          </label>
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
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </aside>
    </>
  );
}
