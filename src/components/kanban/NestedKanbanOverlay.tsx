import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
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
  TouchSensor,
} from '@dnd-kit/core';
import { useState } from 'react';
import NestedStageColumn from './NestedStageColumn';
import CandidateCard from './CandidateCard';
import { Candidate as ApiCandidate } from '../../services/api';
import {
  UmbrellaStage,
  DEFAULT_STAGE_CONFIG,
  getCandidateSubStageId,
  getLegacyStageForRejectedSubStage,
} from '../../types/umbrellaStage';
import { sortCandidatesNewestFirst } from '../../utils/candidateSort';

interface NestedKanbanOverlayProps {
  isOpen: boolean;
  umbrellaStage: UmbrellaStage;
  candidates: ApiCandidate[];
  onClose: () => void;
  onStageChange: (candidateId: string, newStage: string) => Promise<void>;
  onSubStageChange?: (candidateId: string, mainStage: string, subStage: string) => Promise<void>;
  onCandidateClick: (candidate: ApiCandidate) => void;
  onCandidateEdit: (candidate: ApiCandidate) => void;
  onCandidateDelete: (candidateId: string) => void;
  onDownloadResume: (candidateId: string) => void;
  onOpenNotes?: (candidate: ApiCandidate) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  syncingCards?: Set<string>;
  candidateAssignments?: Map<string, { status: string; deadline: string; emailFailed: boolean }>;
  originRect?: DOMRect | null;
}

export default function NestedKanbanOverlay({
  isOpen,
  umbrellaStage,
  candidates,
  onClose,
  onStageChange,
  onSubStageChange,
  onCandidateClick,
  onCandidateEdit,
  onCandidateDelete,
  onDownloadResume,
  onOpenNotes,
  hasEditPermission,
  hasDeletePermission,
  syncingCards = new Set(),
  candidateAssignments,
  originRect,
}: NestedKanbanOverlayProps) {
  const [activeCandidate, setActiveCandidate] = useState<ApiCandidate | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Group candidates by sub-stage
  const candidatesBySubStage: Record<string, ApiCandidate[]> = {};
  
  if (umbrellaStage.subStages) {
    umbrellaStage.subStages.forEach(subStage => {
      candidatesBySubStage[subStage.id] = [];
    });

    candidates.forEach((candidate) => {
      const subStageId = getCandidateSubStageId(candidate, umbrellaStage.id);
      if (subStageId && candidatesBySubStage[subStageId]) {
        candidatesBySubStage[subStageId].push(candidate);
      }
    });

    for (const subStageId of Object.keys(candidatesBySubStage)) {
      candidatesBySubStage[subStageId] = sortCandidatesNewestFirst(
        candidatesBySubStage[subStageId]
      );
    }
  }

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const candidateId =
      typeof event.active.id === 'string'
        ? event.active.id.replace('candidate-', '')
        : String(event.active.id);

    const candidate = candidates.find((c) => c.id === candidateId) ?? null;
    setActiveCandidate(candidate);
    setIsDragging(true);
  }, [candidates]);

  const handleDragOver = useCallback((event: { over?: { id?: unknown } | null }) => {
    if (event?.over?.id) {
      const stage = String(event.over.id);
      setOverColumn(stage);
    } else {
      setOverColumn(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setIsDragging(false);
      setActiveCandidate(null);
      setOverColumn(null);

      if (!over) return;

      const candidateId =
        typeof active.id === 'string'
          ? active.id.replace('candidate-', '')
          : String(active.id);

      const newSubStageId = String(over.id);
      const subStageConfig = umbrellaStage.subStages?.find((s) => s.id === newSubStageId);
      if (!subStageConfig) return;

      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) return;

      const currentSubStageId = getCandidateSubStageId(candidate, umbrellaStage.id);
      if (currentSubStageId === newSubStageId) return;

      // Escalation sub-stages move to a different main kanban column
      if (subStageConfig?.escalationRule === 'move-to-stage' && subStageConfig.escalationTarget) {
        const targetStage = DEFAULT_STAGE_CONFIG.mainStages.find(
          (s) => s.id === subStageConfig.escalationTarget
        );
        if (targetStage) {
          await onStageChange(candidateId, targetStage.name);
        }
        return;
      }

      if (umbrellaStage.id === 'interview') {
        if (!onSubStageChange) return;
        await onSubStageChange(candidateId, 'interview', newSubStageId);
        return;
      }

      if (umbrellaStage.id === 'rejected') {
        const newStageName = getLegacyStageForRejectedSubStage(newSubStageId);
        if (candidate.stage !== newStageName) {
          await onStageChange(candidateId, newStageName);
        }
        return;
      }

      if (umbrellaStage.id === 'follow-up' && onSubStageChange) {
        await onSubStageChange(candidateId, 'follow-up', newSubStageId);
      }
    },
    [candidates, onStageChange, onSubStageChange, umbrellaStage]
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActiveCandidate(null);
    setOverColumn(null);
  }, []);

  // Calculate origin position for animation
  const getOriginStyle = () => {
    if (!originRect) return {};
    return {
      originX: originRect.left + originRect.width / 2,
      originY: originRect.top + originRect.height / 2,
    };
  };

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: 'easeOut' }}
            onClick={onClose}
          />

          {/* Overlay Container */}
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            <motion.div
              className="flex min-h-0 min-w-0 w-full max-w-7xl h-full max-h-[85vh] flex-col overflow-hidden bg-white rounded-3xl shadow-2xl pointer-events-auto"
              layoutId={`umbrella-stage-${umbrellaStage.id}`}
              initial={
                originRect && !prefersReducedMotion
                  ? {
                      x: originRect.left - window.innerWidth / 2 + originRect.width / 2,
                      y: originRect.top - window.innerHeight / 2 + originRect.height / 2,
                      width: originRect.width,
                      height: originRect.height,
                      borderRadius: 8,
                    }
                  : { scale: 0.9, opacity: 0 }
              }
              animate={{
                x: 0,
                y: 0,
                width: '100%',
                height: '100%',
                borderRadius: 24,
                scale: 1,
                opacity: 1,
              }}
              exit={
                originRect && !prefersReducedMotion
                  ? {
                      x: originRect.left - window.innerWidth / 2 + originRect.width / 2,
                      y: originRect.top - window.innerHeight / 2 + originRect.height / 2,
                      width: originRect.width,
                      height: originRect.height,
                      borderRadius: 8,
                      opacity: 0.8,
                    }
                  : { scale: 0.9, opacity: 0 }
              }
              transition={{
                type: 'spring',
                stiffness: prefersReducedMotion ? 500 : 300,
                damping: prefersReducedMotion ? 100 : 30,
                mass: 0.8,
              }}
            >
              {/* Header */}
              <div
                className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4"
                style={{
                  background: `linear-gradient(135deg, ${umbrellaStage.accentColor}08 0%, ${umbrellaStage.accentColor}03 100%)`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${umbrellaStage.accentColor}20` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: umbrellaStage.accentColor }}
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {umbrellaStage.name} {umbrellaStage.id === 'interview' ? 'Pipeline' : ''}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {umbrellaStage.id === 'interview' 
                        ? 'Manage interview workflow and candidate progress'
                        : 'Manage candidates in this stage'
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span
                      className="text-sm font-bold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: `${umbrellaStage.accentColor}15`,
                        color: umbrellaStage.accentColor,
                      }}
                    >
                      {candidates.length} total
                    </span>
                    {/* Interview-specific metrics */}
                    {umbrellaStage.id === 'interview' && umbrellaStage.subStages && (
                      <>
                        {umbrellaStage.subStages.slice(0, 3).map((subStage) => {
                          const count = candidatesBySubStage[subStage.id]?.length || 0;
                          if (count === 0) return null;
                          return (
                            <span
                              key={subStage.id}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md font-medium"
                            >
                              {count} {subStage.name}
                            </span>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Nested Kanban Board — min-w-0 so columns can overflow-x inside this panel */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <div
                    className="nested-kanban-scroll flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-nowrap gap-4 overflow-x-auto overflow-y-hidden p-6"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: `${umbrellaStage.accentColor}40 transparent`,
                    }}
                  >
                    {umbrellaStage.subStages?.map((subStage) => (
                      <NestedStageColumn
                        key={subStage.id}
                        subStage={subStage}
                        candidates={candidatesBySubStage[subStage.id] || []}
                        accentColor={umbrellaStage.accentColor}
                        onCandidateClick={onCandidateClick}
                        onCandidateEdit={onCandidateEdit}
                        onCandidateDelete={onCandidateDelete}
                        onDownloadResume={onDownloadResume}
                        onOpenNotes={onOpenNotes}
                        hasEditPermission={hasEditPermission}
                        hasDeletePermission={hasDeletePermission}
                        isDragging={isDragging}
                        isOver={overColumn === subStage.id}
                        syncingCards={syncingCards}
                        candidateAssignments={candidateAssignments}
                        umbrellaStageId={umbrellaStage.id}
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
                      <div className="scale-[1.02] opacity-95">
                        <CandidateCard
                          candidate={activeCandidate}
                          accentColor={umbrellaStage.accentColor}
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
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
