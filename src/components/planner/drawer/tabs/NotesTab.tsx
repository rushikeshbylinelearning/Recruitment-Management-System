import { useState, useEffect, useRef, useCallback } from 'react';
import { plannerService } from '../../../../services/plannerService';

interface NotesTabProps {
  taskId: number;
}

const MAX_CHARS = 50000;

export default function NotesTab({ taskId }: NotesTabProps) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef('');

  useEffect(() => {
    plannerService.getNotes(taskId).then((data) => {
      const text = data?.note_content ?? '';
      setContent(text);
      latestContentRef.current = text;
      setIsLoading(false);
    });
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [taskId]);

  const saveNow = useCallback(async (text: string) => {
    setStatus('saving');
    try {
      await plannerService.saveNotes(taskId, text);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('idle');
    }
  }, [taskId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > MAX_CHARS) return;
    setContent(val);
    latestContentRef.current = val;
    setStatus('idle');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNow(latestContentRef.current);
    }, 5000);
  };

  const handleBlur = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveNow(latestContentRef.current);
  };

  if (isLoading) {
    return <div className="p-4 animate-pulse h-40 bg-gray-200 dark:bg-neutral-700 rounded" />;
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Notes</span>
        <span className={`text-xs transition-colors duration-150 ${
          status === 'saving' ? 'text-amber-500 animate-pulse' :
          status === 'saved' ? 'text-emerald-600 dark:text-emerald-400' :
          'text-gray-400 dark:text-neutral-500'
        }`}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : `${content.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`}
        </span>
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write notes here… (auto-saves every 5 seconds)"
        className="flex-1 resize-none text-sm px-3 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono leading-relaxed"
      />
    </div>
  );
}
