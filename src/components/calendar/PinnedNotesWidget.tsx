import { useState, useEffect } from 'react';
import { Pin, StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calendarService } from '../../services/calendarService';

interface PinnedNote {
  id: number;
  title: string;
  note_content?: string;
  note_date: string;
  colour: string;
}

export default function PinnedNotesWidget() {
  const [notes, setNotes] = useState<PinnedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    calendarService.getPinnedNotes()
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || notes.length === 0) return null;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pin size={16} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pinned Notes</h3>
        </div>
        <button
          onClick={() => navigate('/calendar')}
          className="text-xs text-red-600 hover:underline"
        >
          Open Calendar
        </button>
      </div>
      <div className="space-y-2">
        {notes.slice(0, 5).map((note) => (
          <button
            key={note.id}
            onClick={() => navigate('/calendar')}
            className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors duration-100"
            style={{ borderLeft: `3px solid ${note.colour || '#8B5CF6'}` }}
          >
            <StickyNote size={14} className="text-purple-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{note.title}</div>
              <div className="text-xs text-gray-400">{note.note_date}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
