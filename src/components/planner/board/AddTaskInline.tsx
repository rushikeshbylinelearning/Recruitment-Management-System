import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

interface AddTaskInlineProps {
  bucketId: number;
  onAdd: (bucketId: number, title: string) => Promise<void>;
}

export default function AddTaskInline({ bucketId, onAdd }: AddTaskInlineProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onAdd(bucketId, title.trim());
      setTitle('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setOpen(false); setTitle(''); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors duration-150 group"
      >
        <Plus className="w-3.5 h-3.5" />
        Add task
      </button>
    );
  }

  return (
    <div className="p-2 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-sm">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title…"
        maxLength={255}
        className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 mb-2"
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex-1 text-xs px-2 py-1.5 rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {saving ? 'Adding…' : 'Add task'}
        </button>
        <button
          onClick={() => { setOpen(false); setTitle(''); }}
          className="p-1.5 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors duration-150"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
