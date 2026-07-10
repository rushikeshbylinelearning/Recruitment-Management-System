import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Edit2, Archive, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import ProgressBar from '../shared/ProgressBar';
import type { Bucket } from '../../../services/plannerService';

interface BucketHeaderProps {
  bucket: Bucket;
  isCollapsed: boolean;
  onToggleCollapse: (id: number) => void;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onArchive?: (id: number) => Promise<void>;
}

export default function BucketHeader({
  bucket,
  isCollapsed,
  onToggleCollapse,
  onRename,
  onDelete,
}: BucketHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(bucket.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleRenameSubmit = async () => {
    if (nameValue.trim() && nameValue.trim() !== bucket.name) {
      await onRename(bucket.id, nameValue.trim());
    }
    setRenaming(false);
  };

  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 rounded-t-xl"
      style={{ borderTop: `3px solid ${bucket.colour || '#6B7280'}` }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => onToggleCollapse(bucket.id)}
        className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors duration-150"
        aria-label={isCollapsed ? 'Expand bucket' : 'Collapse bucket'}
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Bucket name (or rename input) */}
      {renaming ? (
        <input
          ref={renameInputRef}
          type="text"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') { setRenaming(false); setNameValue(bucket.name); }
          }}
          className="flex-1 text-sm font-semibold px-1 py-0.5 rounded border border-red-400 bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-200 focus:outline-none"
          maxLength={100}
        />
      ) : (
        <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-neutral-200 truncate">
          {bucket.name}
        </span>
      )}

      {/* Task count */}
      <span className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums shrink-0">
        {bucket.task_count}
      </span>

      {/* Progress mini bar */}
      {bucket.task_count > 0 && (
        <ProgressBar value={bucket.progress_pct} size="sm" className="w-12 shrink-0" />
      )}

      {/* Menu */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 rounded text-gray-400 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors duration-150"
          aria-label="Bucket options"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-50 w-36 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg py-1">
            <button
              onClick={() => { setRenaming(true); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
            >
              <Edit2 className="w-3.5 h-3.5" /> Rename
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete bucket "${bucket.name}"?`)) onDelete(bucket.id);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
