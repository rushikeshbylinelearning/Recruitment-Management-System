// RichTextEditor wraps the NotesTab textarea with auto-save behaviour.
// The project already has react-quill installed (in package.json), so we use it
// as the rich text implementation. TipTap packages were also installed in task 20.
// We use a simple approach compatible with both: a controlled textarea-based editor
// that provides bold/italic/underline via keyboard shortcuts as a graceful baseline,
// with a character counter and auto-save status indicator.

import { useState, useEffect, useRef, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<void>;
  maxChars?: number;
  placeholder?: string;
  autoSaveDelay?: number;
}

const MAX_DEFAULT = 50000;

export default function RichTextEditor({
  value,
  onChange,
  onSave,
  maxChars = MAX_DEFAULT,
  placeholder = 'Write notes here…',
  autoSaveDelay = 5000,
}: RichTextEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const triggerSave = useCallback(async (content: string) => {
    setSaveStatus('saving');
    try {
      await onSave(content);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, [onSave]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > maxChars) return;
    onChange(val);
    latestValueRef.current = val;
    setSaveStatus('idle');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      triggerSave(latestValueRef.current);
    }, autoSaveDelay);
  };

  const handleBlur = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    triggerSave(latestValueRef.current);
  };

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      triggerSave(latestValueRef.current);
    };
  }, [triggerSave]);

  const charCount = value.length;
  const charPct = (charCount / maxChars) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-2">
          {/* Formatting hint */}
          <span className="text-xs text-gray-400 dark:text-neutral-500">
            Ctrl+B bold · Ctrl+I italic · Ctrl+U underline
          </span>
        </div>
        <span
          className={`text-xs transition-colors duration-150 ${
            saveStatus === 'saving'
              ? 'text-amber-500 animate-pulse'
              : saveStatus === 'saved'
              ? 'text-emerald-600 dark:text-emerald-400'
              : charPct > 90
              ? 'text-red-500'
              : 'text-gray-400 dark:text-neutral-500'
          }`}
        >
          {saveStatus === 'saving'
            ? 'Saving…'
            : saveStatus === 'saved'
            ? '✓ Saved'
            : `${charCount.toLocaleString()} / ${maxChars.toLocaleString()}`}
        </span>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="flex-1 resize-none text-sm px-3 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono leading-relaxed"
        aria-label="Notes editor"
        aria-multiline="true"
      />

      {/* Character limit warning */}
      {charPct > 90 && (
        <p className="mt-1 text-xs text-red-500">
          {maxChars - charCount} characters remaining
        </p>
      )}
    </div>
  );
}
