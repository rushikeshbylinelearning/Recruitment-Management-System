import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { plannerService, Bucket, TaskCard } from '../../../services/plannerService';
import BucketColumn from '../board/BucketColumn';

interface BoardViewProps {
  planId: number;
  onTaskClick: (taskId: number) => void;
  refreshKey?: number;
}

interface BucketWithTasks {
  bucket: Bucket;
  tasks: TaskCard[];
}

export default function BoardView({ planId, onTaskClick, refreshKey }: BoardViewProps) {
  const [columns, setColumns] = useState<BucketWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingBucket, setAddingBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const newBucketInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const buckets = await plannerService.getBuckets(planId);
      const withTasks = await Promise.all(
        buckets.map(async (bucket) => {
          const tasks = await plannerService.getTasks(bucket.id);
          return { bucket, tasks };
        })
      );
      setColumns(withTasks);
    } catch {
      if (!silent) setError('Failed to load board. Please refresh.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (refreshKey != null && refreshKey > 0) fetchData(true);
  }, [refreshKey, fetchData]);

  const handleAddTask = useCallback(async (bucketId: number, title: string) => {
    await plannerService.createTask({ bucket_id: bucketId, title });
    // Re-fetch the affected bucket's tasks
    const tasks = await plannerService.getTasks(bucketId);
    setColumns((prev) =>
      prev.map((col) => (col.bucket.id === bucketId ? { ...col, tasks } : col))
    );
  }, []);

  const handleToggleComplete = useCallback(async (taskId: number, completed: boolean) => {
    await plannerService.updateTask(taskId, {
      status: completed ? 'completed' : 'pending',
      ...(completed ? {} : { completion_percentage: 0 }),
    });
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        tasks: col.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: completed ? 'completed' : 'pending',
                completion_percentage: completed ? 100 : 0,
                timer_started_at: completed ? null : t.timer_started_at,
              }
            : t
        ),
      }))
    );
  }, []);

  const handleToggleCollapse = useCallback(async (bucketId: number) => {
    await plannerService.toggleBucketCollapse(bucketId);
    setColumns((prev) =>
      prev.map((col) =>
        col.bucket.id === bucketId
          ? { ...col, bucket: { ...col.bucket, collapsed: !col.bucket.collapsed } }
          : col
      )
    );
  }, []);

  const handleRenameBucket = useCallback(async (bucketId: number, name: string) => {
    await plannerService.updateBucket(bucketId, { name } as Partial<Bucket>);
    setColumns((prev) =>
      prev.map((col) =>
        col.bucket.id === bucketId ? { ...col, bucket: { ...col.bucket, name } } : col
      )
    );
  }, []);

  const handleDeleteBucket = useCallback(async (bucketId: number) => {
    await plannerService.deleteBucket(bucketId);
    setColumns((prev) => prev.filter((col) => col.bucket.id !== bucketId));
  }, []);

  const handleAddBucket = useCallback(async () => {
    setAddingBucket(true);
    setNewBucketName('');
    // focus happens via useEffect below
  }, []);

  const handleConfirmAddBucket = useCallback(async () => {
    const name = newBucketName.trim();
    if (!name) {
      setAddingBucket(false);
      return;
    }
    setAddingBucket(false);
    setNewBucketName('');
    await plannerService.createBucket(planId, { name });
    await fetchData();
  }, [newBucketName, planId, fetchData]);

  const handleCancelAddBucket = useCallback(() => {
    setAddingBucket(false);
    setNewBucketName('');
  }, []);

  useEffect(() => {
    if (addingBucket) {
      newBucketInputRef.current?.focus();
    }
  }, [addingBucket]);

  if (isLoading) {
    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-72 shrink-0 h-64 rounded-xl bg-gray-200 dark:bg-neutral-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-4 p-4 overflow-x-auto h-full items-start"
      style={{ minHeight: 0 }}
    >
      {columns.map(({ bucket, tasks }) => (
        <BucketColumn
          key={bucket.id}
          bucket={bucket}
          tasks={tasks}
          onTaskClick={onTaskClick}
          onAddTask={handleAddTask}
          onToggleComplete={handleToggleComplete}
          onToggleCollapse={handleToggleCollapse}
          onRenameBucket={handleRenameBucket}
          onDeleteBucket={handleDeleteBucket}
        />
      ))}

      {/* Add bucket — inline input or trigger button */}
      {addingBucket ? (
        <div className="flex flex-col gap-2 w-60 shrink-0 px-3 py-3 rounded-xl border-2 border-dashed border-[#E8B84B] dark:border-[#E8B84B]/60 bg-white dark:bg-neutral-800">
          <input
            ref={newBucketInputRef}
            type="text"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmAddBucket();
              if (e.key === 'Escape') handleCancelAddBucket();
            }}
            placeholder="Bucket name…"
            className="w-full text-sm bg-transparent outline-none text-gray-800 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleConfirmAddBucket}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#E8B84B] text-white text-xs font-medium hover:bg-[#d4a43e] transition-colors"
            >
              <Check className="w-3 h-3" /> Add
            </button>
            <button
              onClick={handleCancelAddBucket}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleAddBucket}
          className="flex items-center gap-2 w-60 shrink-0 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 text-gray-400 dark:text-neutral-500 hover:border-gray-400 dark:hover:border-neutral-500 hover:text-gray-500 dark:hover:text-neutral-400 transition-all duration-150"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add bucket</span>
        </button>
      )}
    </div>
  );
}
