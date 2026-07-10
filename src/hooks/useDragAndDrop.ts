import { useState, useCallback, useRef } from 'react';
import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { plannerService, TaskCard, Bucket } from '../services/plannerService';

export interface BoardState {
  buckets: Bucket[];
  tasksByBucket: Record<number, TaskCard[]>;
}

interface UseDragAndDropProps {
  planId: number;
  state: BoardState;
  onStateChange: (state: BoardState) => void;
  onError?: (msg: string) => void;
}

export function useDragAndDrop({ planId, state, onStateChange, onError }: UseDragAndDropProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const snapshotRef = useRef<BoardState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setIsDragging(true);
    // Snapshot current state for rollback
    snapshotRef.current = {
      buckets: [...state.buckets],
      tasksByBucket: Object.fromEntries(
        Object.entries(state.tasksByBucket).map(([k, v]) => [k, [...v]])
      ),
    };
  }, [state]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Identify if dragging a task or a bucket
    const isTask = activeIdStr.startsWith('task-');
    const isBucket = activeIdStr.startsWith('bucket-');

    if (isTask) {
      const activeTaskId = parseInt(activeIdStr.replace('task-', ''), 10);
      const overBucketId = overIdStr.startsWith('bucket-')
        ? parseInt(overIdStr.replace('bucket-', ''), 10)
        : parseInt(overIdStr.replace('task-', ''), 10); // over a task → use its bucket

      // Find source bucket
      let sourceBucketId: number | null = null;
      for (const [bid, tasks] of Object.entries(state.tasksByBucket)) {
        if (tasks.some((t) => t.id === activeTaskId)) {
          sourceBucketId = parseInt(bid, 10);
          break;
        }
      }

      if (sourceBucketId == null) return;

      // Find target bucket
      let targetBucketId: number | null = null;
      if (overIdStr.startsWith('bucket-')) {
        targetBucketId = parseInt(overIdStr.replace('bucket-', ''), 10);
      } else {
        // Over a task — find its bucket
        for (const [bid, tasks] of Object.entries(state.tasksByBucket)) {
          if (tasks.some((t) => t.id === parseInt(overIdStr.replace('task-', ''), 10))) {
            targetBucketId = parseInt(bid, 10);
            break;
          }
        }
      }

      if (targetBucketId == null || sourceBucketId === targetBucketId) return;

      // Prevent cross-plan by checking same planId — buckets already scoped to planId
      // (cross-plan validation is enforced server-side too)
      const targetBucket = state.buckets.find((b) => b.id === targetBucketId);
      if (!targetBucket) return;

      // Optimistic move between buckets
      const task = state.tasksByBucket[sourceBucketId]?.find((t) => t.id === activeTaskId);
      if (!task) return;

      const newTasksByBucket = {
        ...state.tasksByBucket,
        [sourceBucketId]: state.tasksByBucket[sourceBucketId].filter((t) => t.id !== activeTaskId),
        [targetBucketId]: [...(state.tasksByBucket[targetBucketId] ?? []), { ...task, bucket_id: targetBucketId }],
      };
      onStateChange({ ...state, tasksByBucket: newTasksByBucket });
    }

    if (isBucket) {
      // Reorder buckets optimistically
      const activeBucketId = parseInt(activeIdStr.replace('bucket-', ''), 10);
      const overBucketId = parseInt(overIdStr.replace('bucket-', ''), 10);
      if (activeBucketId === overBucketId) return;

      const oldIndex = state.buckets.findIndex((b) => b.id === activeBucketId);
      const newIndex = state.buckets.findIndex((b) => b.id === overBucketId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(state.buckets, oldIndex, newIndex).map((b, i) => ({
        ...b,
        position: i,
      }));
      onStateChange({ ...state, buckets: reordered });
    }
  }, [state, onStateChange]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setIsDragging(false);
    setActiveId(null);

    const { active, over } = event;
    if (!over) {
      // Cancelled — rollback
      if (snapshotRef.current) onStateChange(snapshotRef.current);
      snapshotRef.current = null;
      return;
    }

    const activeIdStr = String(active.id);
    const isTask = activeIdStr.startsWith('task-');
    const isBucket = activeIdStr.startsWith('bucket-');

    try {
      if (isTask) {
        const activeTaskId = parseInt(activeIdStr.replace('task-', ''), 10);
        // Find current bucket
        let currentBucketId: number | null = null;
        for (const [bid, tasks] of Object.entries(state.tasksByBucket)) {
          if (tasks.some((t) => t.id === activeTaskId)) {
            currentBucketId = parseInt(bid, 10);
            break;
          }
        }
        const originalBucketId = (() => {
          if (!snapshotRef.current) return null;
          for (const [bid, tasks] of Object.entries(snapshotRef.current.tasksByBucket)) {
            if (tasks.some((t) => t.id === activeTaskId)) return parseInt(bid, 10);
          }
          return null;
        })();

        if (currentBucketId != null && originalBucketId != null && currentBucketId !== originalBucketId) {
          // Cross-bucket move — call move API
          await plannerService.moveTask(activeTaskId, currentBucketId);
        } else if (currentBucketId != null) {
          // Reorder within bucket
          const tasks = state.tasksByBucket[currentBucketId] ?? [];
          const reorderPayload = tasks.map((t, i) => ({
            id: t.id,
            position: i,
            bucket_id: currentBucketId!,
          }));
          await plannerService.reorderTasks(reorderPayload);
        }
      }

      if (isBucket) {
        const reorderPayload = state.buckets.map((b) => ({ id: b.id, position: b.position }));
        await plannerService.reorderBuckets(reorderPayload);
      }
    } catch (err) {
      // Rollback on server failure
      if (snapshotRef.current) {
        onStateChange(snapshotRef.current);
        onError?.('Reorder failed. Changes have been reverted.');
      }
    } finally {
      snapshotRef.current = null;
    }
  }, [state, onStateChange, onError]);

  return {
    sensors,
    activeId,
    isDragging,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
