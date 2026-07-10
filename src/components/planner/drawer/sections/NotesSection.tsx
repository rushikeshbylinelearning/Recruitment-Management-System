/**
 * NotesSection — Section 4 of the left panel
 *
 * Embedded notes editor with:
 *   - Autosave every 5 seconds (debounced)
 *   - Save on blur
 *   - Character counter
 *   - Save status indicator (Saving… / Saved / idle)
 *   - Last edited timestamp
 *
 * Uses existing plannerService.getNotes / saveNotes (no API changes).
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Clock, Save } from 'lucide-react';
import { plannerService } from '../../../../services/plannerService';

const MAX_CHARS = 50_000;
const AUTOSAVE_DELAY_MS = 5_000;

interface NotesSectionProps {
  taskId: number;
}

export default memo(function NotesSection({ taskId }: NotesSectionProps) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef('');

  // Load notes
  useEffect(() => {
    setIsLoading(true);
    plannerService.getNotes(taskId).then((data) => {
      const text = (data as { note_content?: string })?.note_content ?? '';
      setContent(text);
      latestRef.current = text;
      setIsLoading(false);
    });
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [taskId]);

  const saveNow = useCallback(
    async (text: string) => {
      if (text === latestRef.current && status === 'saved') return;
      setStatus('saving');
      try {
        await plannerService.saveNotes(taskId, text);
        setStatus('saved');
        setLastSaved(new Date());
        setTimeout(() => setStatus('idle'), 3000);
      } catch {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 4000);
      }
    },
    [taskId, status]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > MAX_CHARS) return;
    setContent(val);
    latestRef.current = val;
    setStatus('idle');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNow(latestRef.current);
    }, AUTOSAVE_DELAY_MS);
  };

  const handleBlur = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveNow(latestRef.current);
  };

  const charPct = (content.length / MAX_CHARS) * 100;

  if (isLoading) {
    return (
      <div className="h-32 bg-gray-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500">
              <Clock className="w-3 h-3" />
              Saved {lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <span
          className={`flex items-center gap-1 text-xs transition-colors duration-150 ${
            status === 'saving'
              ? 'text-amber-500 animate-pulse'
              : status === 'saved'
              ? 'text-emerald-600 dark:text-emerald-400'
              : status === 'error'
              ? 'text-red-500'
              : charPct > 90
              ? 'text-red-500'
              : 'text-gray-400 dark:text-neutral-500'
          }`}
        >
          {status === 'saving' ? (
            <>
              <span className="w-2.5 h-2.5 border border-amber-500 border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : status === 'saved' ? (
            <>
              <Save className="w-3 h-3" />
              Saved
            </>
          ) : status === 'error' ? (
            'Save failed'
          ) : (
            `${content.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`
          )}
        </span>
      </div>

      {/* Editor */}
      <textarea
        value={content}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write notes here… Markdown supported. Auto-saves every 5 seconds."
        rows={8}
        className="w-full resize-none text-sm px-3 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400 transition-all duration-150 font-mono leading-relaxed"
        aria-label="Task notes"
        aria-multiline="true"
      />

      {/* Near-limit warning */}
      {charPct > 90 && (
        <p className="text-xs text-red-500">
          {MAX_CHARS - content.length} characters remaining
        </p>
      )}
    </div>
  );
});
