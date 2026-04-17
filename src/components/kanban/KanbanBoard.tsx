import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  closestCenter,
  CollisionDetection,
  TouchSensor,
} from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import CandidateCard from './CandidateCard';
import { ErrorToast } from './ErrorToast';
import InterviewModal from '../InterviewModal';
import AssignmentModal from '../AssignmentModal';
import NotesPanel from '../NotesPanel';
import { Candidate as ApiCandidate } from '../../services/api';
import { InterviewFormPayload } from '../../types/interview';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { useSyncManager } from '../../hooks/useSyncManager';
import { useToastManager } from '../../hooks/useToastManager';

interface KanbanBoardProps {
  stages: string[];
  candidatesByStage: Record<string, ApiCandidate[]>;
  onStageChange: (candidateId: string, newStage: string) => Promise<void>;
  onCandidateClick: (candidate: ApiCandidate) => void;
  onCandidateEdit: (candidate: ApiCandidate) => void;
  onCandidateDelete: (candidateId: string) => void;
  onDownloadResume: (candidateId: string) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

// Flat, minimal accent colors — one per stage
const STAGE_ACCENTS: Record<string, string> = {
  Applied: '#6366f1',
  Screening: '#f59e0b',
  Interview: '#f97316',
  Offer: '#8b5cf6',
  Hired: '#10b981',
  Rejected: '#ef4444',
  'On Hold': '#6b7280',
  'No Show - Interview': '#ea580c',
  'No Show - Onboarding': '#ec4899',
  'Last Minute Back Out': '#dc2626',
};

export default function KanbanBoard({
  stages,
  candidatesByStage,
  onStageChange,
  onCandidateClick,
  onCandidateEdit,
  onCandidateDelete,
  onDownloadResume,
  hasEditPermission,
  hasDeletePermission,
}: KanbanBoardProps) {
  const [optimisticCandidatesByStage, setOptimisticCandidatesByStage] =
    useState<Record<string, ApiCandidate[]>>(candidatesByStage);

  // All useState hooks first
  const [activeCandidate, setActiveCandidate] = useState<ApiCandidate | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [pendingInterviewCandidate, setPendingInterviewCandidate] = useState<ApiCandidate | null>(null);
  const [pendingAssignmentCandidate, setPendingAssignmentCandidate] = useState<ApiCandidate | null>(null);
  const [candidateAssignments, setCandidateAssignments] = useState<Map<string, { status: string; deadline: string; emailFailed: boolean }>>(new Map());
  const [notesPanelCandidate, setNotesPanelCandidate] = useState<ApiCandidate | null>(null);

  // All useRef hooks
  const boardRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());
  const lastDropTime = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const optimisticRef = useRef<Record<string, ApiCandidate[]>>(candidatesByStage);
  const lastStableRef = useRef<Record<string, ApiCandidate[]>>(candidatesByStage);

  // All custom hooks
  const { syncState, syncDrop, manualRetry } = useSyncManager(onStageChange);
  const { toasts, showToast, dismissToast } = useToastManager();

  // Constants
  const DEBOUNCE_DELAY = 100; // ms

  // Initialize column refs (do this before using them)
  useEffect(() => {
    stages.forEach((stage) => {
      if (!columnRefs.current.has(stage)) {
        columnRefs.current.set(stage, { current: null });
      }
    });
  }, [stages]);

  // Keep optimistic state in sync with source-of-truth props (but don't fight the drag gesture)
  useEffect(() => {
    // Important: do NOT re-sync just because isDragging toggled to false,
    // otherwise we instantly overwrite the optimistic drop with stale props.
    if (!isDraggingRef.current) {
      setOptimisticCandidatesByStage(candidatesByStage);
      lastStableRef.current = candidatesByStage;
    }
  }, [candidatesByStage]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    optimisticRef.current = optimisticCandidatesByStage;
  }, [optimisticCandidatesByStage]);

  // Auto-scroll hook - moved after all other hooks
  useAutoScroll({
    boardRef,
    columnRefs: columnRefs.current,
    isDragging,
    cursorPosition,
  });

  // Track live pointer position (DragMoveEvent's activatorEvent is NOT the live cursor)
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      setCursorPosition({ x: t.clientX, y: t.clientY });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [isDragging]);

  // ESC key to cancel drag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragging) {
        setIsDragging(false);
        setActiveCandidate(null);
        setCursorPosition(null);
        setDropIndex(null);
        setOverColumn(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging]);

  // Poll assignment statuses every 5 seconds
  useEffect(() => {
    const fetchAssignments = () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
      fetch('/api/candidate-assignments', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data: unknown) => {
          if (!data) return;
          const parsed = data as Record<string, unknown>;
          const recordsUnknown = Array.isArray(data)
            ? data
            : (Array.isArray(parsed.data)
                ? parsed.data
                : Array.isArray(parsed.assignments)
                  ? parsed.assignments
                  : []);
          const records = recordsUnknown as Array<Record<string, unknown>>;
          const map = new Map<string, { status: string; deadline: string; emailFailed: boolean }>();
          // Priority order: Submitted > Reviewed > Overdue > Assigned
          const statusPriority: Record<string, number> = {
            Submitted: 4,
            Reviewed: 3,
            Overdue: 2,
            Assigned: 1,
          };
          records.forEach((r) => {
            const candidateId = String(r.candidate_id);
            if (!candidateId) return;

            const status = typeof r.status === 'string' ? r.status : '';
            const existing = map.get(candidateId);
            const newPriority = statusPriority[status] ?? 0;
            const existingPriority = existing ? (statusPriority[existing.status] ?? 0) : -1;
            if (!existing || newPriority > existingPriority) {
              map.set(candidateId, {
                status,
                deadline: typeof r.deadline === 'string' ? r.deadline : '',
                emailFailed: r.email_status === 'Failed',
              });
            }
          });
          setCandidateAssignments(map);
        })
        .catch(() => {/* silently ignore polling errors */});
    };

    fetchAssignments();
    const interval = setInterval(fetchAssignments, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sensors must be declared at top-level (Rules of Hooks)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection with drop index calculation
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First, find the closest column using standard closestCenter
    const collisions = closestCenter(args);

    if (!collisions || collisions.length === 0) return [];

    // Note: drop index is calculated from data + scroll position (not DOM),
    // because columns are virtualized and most cards are not mounted.
    return collisions;
  }, []);

  // Haptic feedback for mobile
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10); // 10ms vibration
    }
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const candidateId =
        typeof event.active.id === 'string'
          ? event.active.id.replace('candidate-', '')
          : String(event.active.id);

      const candidate =
        Object.values(optimisticCandidatesByStage).flat().find((c) => c.id === candidateId) ??
        null;

      setActiveCandidate(candidate);
      setIsDragging(true);
      triggerHaptic();
    },
    [optimisticCandidatesByStage, triggerHaptic]
  );

  // Compute dropIndex based on cursor position + scroll container (virtualization-safe).
  useEffect(() => {
    if (!isDragging || !cursorPosition) return;
    if (!overColumn) return;

    const stage = overColumn;
    const columnRef = columnRefs.current.get(stage);
    const columnEl = columnRef?.current;
    const list = optimisticRef.current[stage] ?? [];

    if (!columnEl) return;

    const rect = columnEl.getBoundingClientRect();
    const relativeY = cursorPosition.y - rect.top;
    const scrollTop = columnEl.scrollTop ?? 0;
    const contentY = scrollTop + relativeY;

    // Estimate: card content (~120px) + gap (~10px).
    const ESTIMATED_ITEM_PITCH = 130;
    const nextIndex = Math.max(0, Math.min(list.length, Math.floor(contentY / ESTIMATED_ITEM_PITCH)));
    setDropIndex(nextIndex);
  }, [cursorPosition, isDragging, overColumn]);

  // Update overColumn from DnD collisions (stage-level droppables)
  const handleDragOver = useCallback((event: { over?: { id?: unknown } | null }) => {
    if (event?.over?.id) {
      const stage = String(event.over.id);
      setOverColumn(stages.includes(stage) ? stage : null);
    } else {
      setOverColumn(null);
    }
  }, [stages]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      // Minimal diagnostics for "drop not completing" reports
      setIsDragging(false);
      setActiveCandidate(null);
      setCursorPosition(null);
      setDropIndex(null);
      setOverColumn(null);

      if (!over) {
        return;
      }

      // Debounce rapid drops
      const now = Date.now();
      if (now - lastDropTime.current < DEBOUNCE_DELAY) {
        console.warn('Drop ignored: too rapid');
        return;
      }
      lastDropTime.current = now;

      const activeData = (active.data?.current ?? {}) as Record<string, unknown>;
      const candidateIdFromData = typeof activeData.candidateId === 'string' ? activeData.candidateId : undefined;
      const candidateId =
        typeof candidateIdFromData === 'string'
          ? candidateIdFromData
          : typeof active.id === 'string'
            ? active.id.replace('candidate-', '')
            : String(active.id);

      const newStage = String(over.id);
      const desiredIndex =
        typeof dropIndex === 'number' && Number.isFinite(dropIndex) ? dropIndex : null;

      // Validate stage
      if (!stages.includes(newStage)) {
        console.error('Invalid stage:', newStage);
        return;
      }

      const fromStageFromDnd = typeof activeData.stage === 'string' ? activeData.stage : undefined;
      const currentStage =
        (fromStageFromDnd && stages.includes(fromStageFromDnd) ? fromStageFromDnd : undefined) ??
        Object.entries(optimisticCandidatesByStage).find(([, candidates]) =>
          candidates.some((c) => c.id === candidateId)
        )?.[0];

      if (!currentStage) return;

      // Drops into modal-gated stages should not move immediately
      if (currentStage !== newStage && newStage === 'Interview') {
        const candidate =
          Object.values(optimisticCandidatesByStage).flat().find((c) => c.id === candidateId) ??
          null;
        setPendingInterviewCandidate(candidate);
        return;
      }

      if (currentStage !== newStage && newStage === 'Screening') {
        const candidate =
          Object.values(optimisticCandidatesByStage).flat().find((c) => c.id === candidateId) ??
          null;
        setPendingAssignmentCandidate(candidate);
        return;
      }

      const rollbackSnapshot = optimisticRef.current;

      // Optimistic UI update (reorder within column OR move across columns)
      setOptimisticCandidatesByStage((prev) => {
        const sourceList = Array.from(prev[currentStage] ?? []);
        const destList = currentStage === newStage ? sourceList : Array.from(prev[newStage] ?? []);

        const sourceIndex = sourceList.findIndex((c) => c.id === candidateId);
        if (sourceIndex === -1) return prev;

        const [moved] = sourceList.splice(sourceIndex, 1);
        const movedWithStage =
          currentStage === newStage ? moved : ({ ...moved, stage: newStage } as ApiCandidate);

        const insertAt = Math.max(
          0,
          Math.min(desiredIndex ?? destList.length, destList.length)
        );
        destList.splice(insertAt, 0, movedWithStage);

        if (currentStage === newStage) {
          return {
            ...prev,
            [currentStage]: destList,
          };
        }

        return {
          ...prev,
          [currentStage]: sourceList,
          [newStage]: destList,
        };
      });

      // Reorder within same stage is UI-only unless the backend supports ordering.
      if (currentStage === newStage) return;

      // Backend sync with retry
      try {
        await syncDrop(candidateId, newStage, currentStage);
      } catch {
        // Revert optimistic update back to last known good state
        setOptimisticCandidatesByStage(rollbackSnapshot ?? lastStableRef.current);
        showToast(`Failed to move candidate to ${newStage}`, () =>
          manualRetry(candidateId, newStage, currentStage)
        );
      }
    },
    [optimisticCandidatesByStage, stages, syncDrop, showToast, manualRetry, dropIndex]
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActiveCandidate(null);
    setCursorPosition(null);
    setDropIndex(null);
    setOverColumn(null);
  }, []);

  const handleInterviewSubmit = useCallback(
    async (payload: InterviewFormPayload | null) => {
      const candidate = pendingInterviewCandidate!;
      const currentStage = Object.entries(candidatesByStage).find(([, candidates]) =>
        candidates.some((c) => c.id === candidate.id)
      )?.[0];

      // If payload is null, user clicked "Skip Interview" - just move the card
      if (payload === null) {
        if (currentStage) {
          try {
            await syncDrop(candidate.id, 'Interview', currentStage);
          } catch {
            showToast(
              `Failed to move candidate to Interview`,
              () => manualRetry(candidate.id, 'Interview', currentStage)
            );
          }
        }
        setPendingInterviewCandidate(null);
        return;
      }

      // Otherwise, schedule the interview first
      const token = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
      const response = await fetch('/api/interviews/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorBody: Record<string, unknown> = {};
        try {
          const parsed: unknown = await response.json();
          errorBody = (parsed ?? {}) as Record<string, unknown>;
        } catch {
          // ignore parse errors
        }
        throw new Error(String(errorBody.error ?? 'UNKNOWN'));
      }

      // Success: commit the stage change
      if (currentStage) {
        try {
          await syncDrop(candidate.id, 'Interview', currentStage);
        } catch {
          showToast(
            `Failed to move candidate to Interview`,
            () => manualRetry(candidate.id, 'Interview', currentStage)
          );
        }
      }

      setPendingInterviewCandidate(null);
    },
    [pendingInterviewCandidate, candidatesByStage, syncDrop, showToast, manualRetry]
  );

  const handleAssignmentSubmit = useCallback(
    async (payload: any) => {
      const candidate = pendingAssignmentCandidate!;
      const currentStage = Object.entries(candidatesByStage).find(([, candidates]) =>
        candidates.some((c) => c.id === candidate.id)
      )?.[0];

      if (currentStage) {
        try {
          // If payload is null, user clicked "Skip Assignment" - just move the card
          await syncDrop(candidate.id, 'Screening', currentStage);
        } catch {
          showToast(
            `Failed to move candidate to Screening`,
            () => manualRetry(candidate.id, 'Screening', currentStage)
          );
        }
      }

      setPendingAssignmentCandidate(null);
    },
    [pendingAssignmentCandidate, candidatesByStage, syncDrop, showToast, manualRetry]
  );

  const activeAccent = activeCandidate
    ? STAGE_ACCENTS[activeCandidate.stage] || '#6366f1'
    : '#6366f1';

  const handleOpenNotes = useCallback((candidate: ApiCandidate) => {
    setNotesPanelCandidate(candidate);
  }, []);

  // Detect mobile for enhanced visual feedback
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Screen reader announcements */}
        <div role="status" aria-live="assertive" className="sr-only">
          {isDragging && activeCandidate && `Dragging ${activeCandidate.name}`}
          {!isDragging && activeCandidate && `Dropped ${activeCandidate.name}`}
        </div>

        <div
          ref={boardRef}
          className="flex gap-3 overflow-x-auto pb-4 px-1 min-h-[600px] bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-100"
          style={{ scrollbarWidth: 'thin' }}
        >
          {stages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              candidates={optimisticCandidatesByStage[stage] || []}
              accentColor={STAGE_ACCENTS[stage] || '#6b7280'}
              onCandidateClick={onCandidateClick}
              onCandidateEdit={onCandidateEdit}
              onCandidateDelete={onCandidateDelete}
              onDownloadResume={onDownloadResume}
              onOpenNotes={handleOpenNotes}
              hasEditPermission={hasEditPermission}
              hasDeletePermission={hasDeletePermission}
              isDragging={isDragging}
              isOver={overColumn === stage}
              dropIndex={overColumn === stage ? dropIndex : null}
              syncingCards={syncState.syncingCards}
              columnRef={columnRefs.current.get(stage)!}
              candidateAssignments={candidateAssignments}
            />
          ))}
        </div>

        <DragOverlay
          dropAnimation={
            prefersReducedMotion
              ? null
              : {
                  duration: 250,
                  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }
          }
        >
          {activeCandidate && (
            <div
              className={`${isMobile ? 'scale-[1.02]' : 'scale-[1.02]'} opacity-95`}
              style={{
                willChange: 'transform',
                cursor: 'grabbing',
                boxShadow: 'none',
                filter: 'none',
              }}
            >
              <CandidateCard
                candidate={activeCandidate}
                accentColor={activeAccent}
                onClick={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onDownloadResume={() => {}}
                hasEditPermission={false}
                hasDeletePermission={false}
                isDragging={true}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Error toasts */}
      {toasts.map((toast) => (
        <ErrorToast
          key={toast.id}
          message={toast.message}
          onRetry={toast.onRetry}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}

      {/* Interview scheduling modal */}
      <InterviewModal
        candidate={pendingInterviewCandidate}
        isOpen={pendingInterviewCandidate !== null}
        mode="schedule"
        onClose={() => setPendingInterviewCandidate(null)}
        onSubmit={handleInterviewSubmit}
      />

      {/* Assignment dispatch modal */}
      <AssignmentModal
        candidate={pendingAssignmentCandidate}
        isOpen={pendingAssignmentCandidate !== null}
        onClose={() => setPendingAssignmentCandidate(null)}
        onSubmit={handleAssignmentSubmit}
      />

      {/* HR Notes side panel */}
      <NotesPanel
        candidateId={notesPanelCandidate?.id ?? ''}
        candidateName={notesPanelCandidate?.name}
        isOpen={notesPanelCandidate !== null}
        onClose={() => setNotesPanelCandidate(null)}
      />
    </>
  );
}
