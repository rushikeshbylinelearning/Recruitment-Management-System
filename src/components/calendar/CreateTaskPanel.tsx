import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { plannerService, Plan, Bucket } from '../../services/plannerService';
import { toDateKey } from './constants';

interface CreateTaskPanelProps {
  isOpen: boolean;
  date: Date | null;
  onClose: () => void;
  onCreated: (taskId: number) => void;
}

export default function CreateTaskPanel({ isOpen, date, onClose, onCreated }: CreateTaskPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [bucketId, setBucketId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setDescription('');
    setDueDate(date ? toDateKey(date) : toDateKey(new Date()));
    setPriority('medium');
    setError('');
    plannerService.getPlans().then((p) => {
      setPlans(p);
      if (p.length > 0) {
        setPlanId(p[0].id);
      }
    });
  }, [isOpen, date]);

  useEffect(() => {
    if (!planId) { setBuckets([]); return; }
    plannerService.getBuckets(planId).then((b) => {
      setBuckets(b);
      setBucketId(b.length > 0 ? b[0].id : null);
    });
  }, [planId]);

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!bucketId) { setError('Select a bucket'); return; }
    setSaving(true);
    setError('');
    try {
      const taskId = await plannerService.createTask({
        bucket_id: bucketId,
        title: title.trim(),
        description,
        due_date: dueDate,
        priority,
      });
      onCreated(taskId);
      onClose();
    } catch {
      setError('Failed to create task');
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
          <h2 className="font-semibold">Create Planner Task</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div>
            <label className="text-xs font-medium text-gray-500">Task Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Plan</label>
              <select value={planId ?? ''} onChange={(e) => setPlanId(parseInt(e.target.value, 10))} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Bucket</label>
              <select value={bucketId ?? ''} onChange={(e) => setBucketId(parseInt(e.target.value, 10))} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </aside>
    </>
  );
}
