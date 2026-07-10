import type { Bucket, TaskCard } from '../../../services/plannerService';
import BucketHeader from './BucketHeader';
import TaskCard from './TaskCard';
import AddTaskInline from './AddTaskInline';

interface BucketColumnProps {
  bucket: Bucket;
  tasks: TaskCard[];
  onTaskClick: (taskId: number) => void;
  onAddTask: (bucketId: number, title: string) => Promise<void>;
  onToggleCollapse: (bucketId: number) => void;
  onRenameBucket: (bucketId: number, name: string) => Promise<void>;
  onDeleteBucket: (bucketId: number) => Promise<void>;
  isDraggingOver?: boolean;
}

export default function BucketColumn({
  bucket,
  tasks,
  onTaskClick,
  onAddTask,
  onToggleCollapse,
  onRenameBucket,
  onDeleteBucket,
  isDraggingOver = false,
}: BucketColumnProps) {
  return (
    <div
      className={`flex flex-col w-72 shrink-0 rounded-xl border transition-all duration-150 ${
        isDraggingOver
          ? 'border-red-400 bg-red-50/50 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900'
      }`}
    >
      <BucketHeader
        bucket={bucket}
        isCollapsed={bucket.collapsed}
        onToggleCollapse={onToggleCollapse}
        onRename={onRenameBucket}
        onDelete={onDeleteBucket}
      />

      {!bucket.collapsed && (
        <div className="flex flex-col gap-2 p-2 min-h-[80px] flex-1">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
            />
          ))}
          <AddTaskInline bucketId={bucket.id} onAdd={onAddTask} />
        </div>
      )}
    </div>
  );
}
