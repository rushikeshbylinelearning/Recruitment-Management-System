import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { plannerService } from '../../../../services/plannerService';
import ProgressBar from '../../shared/ProgressBar';

interface ChecklistItem {
  id: number;
  item_text: string;
  is_checked: boolean;
  position: number;
}

interface ChecklistTabProps {
  taskId: number;
}

export default function ChecklistTab({ taskId }: ChecklistTabProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newText, setNewText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = async () => {
    const data = await plannerService.getChecklists(taskId);
    setItems(data ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchItems(); }, [taskId]);

  const total = items.length;
  const checked = items.filter((i) => i.is_checked).length;
  const progress = total > 0 ? Math.floor((checked / total) * 100) : 0;

  const handleAdd = async () => {
    if (!newText.trim()) return;
    await plannerService.addChecklistItem(taskId, newText.trim());
    setNewText('');
    fetchItems();
  };

  const handleToggle = async (item: ChecklistItem) => {
    const updated = items.map((i) => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i);
    setItems(updated);
    await plannerService.updateChecklistItem(item.id, { is_checked: !item.is_checked });
  };

  const handleDelete = async (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await plannerService.deleteChecklistItem(id);
  };

  if (isLoading) {
    return <div className="p-4 animate-pulse space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-200 dark:bg-neutral-700 rounded" />)}</div>;
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      {total > 0 && (
        <div className="flex items-center gap-2">
          <ProgressBar value={progress} showLabel size="md" className="flex-1" />
          <span className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums shrink-0">{checked}/{total}</span>
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={item.is_checked}
              onChange={() => handleToggle(item)}
              className="w-4 h-4 rounded accent-red-600 cursor-pointer"
            />
            <span className={`flex-1 text-sm ${item.is_checked ? 'line-through text-gray-400 dark:text-neutral-500' : 'text-gray-700 dark:text-neutral-300'}`}>
              {item.item_text}
            </span>
            <button
              onClick={() => handleDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all duration-150"
              aria-label="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {/* Add item */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add item…"
          maxLength={500}
          className="flex-1 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors duration-150"
          aria-label="Add checklist item"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
