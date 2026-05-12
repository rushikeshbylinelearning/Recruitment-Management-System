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
import { UmbrellaStage, SubStage, DEFAULT_STAGE_CONFIG } from '../../types/umbrellaStage';

interface NestedKanbanOverlayProps {
  isOpen: boolean;
  umbrellaStage: UmbrellaStage;
  candidates: ApiCandidate[];
  onClose: () => void;
  onStageChange: (candidateId: string, newStage: string) => Promise<void>;
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

    candidates.forEach(candidate => {
      let subStageId = '';
      
      // Map legacy stage names to sub-stage IDs based on umbrella type
      if (umbrellaStage.id === 'rejected') {
        // Rejected umbrella mapping
        if (candidate.stage === 'Rejected') subStageId = 'rejected';
        else if (candidate.stage === 'On Hold') subStageId = 'on-hold';
        else if (candidate.stage === 'Profile Not Matched') subStageId = 'profile-not-matched';
        else if (candidate.stage === 'Last Minute Back Out') subStageId = 'last-minute-back-out';
      } else if (umbrellaStage.id === 'interview') {
        // Interview umbrella mapping
        // For now, distribute candidates or use default
        // In production, check candidate.subStage or metadata
        subStageId = 'came-down'; // Default to "Came Down"
      }

      if (candidatesBySubStage[subStageId]) {
        candidatesBySubStage[subStageId].push(candidate);
      }
    });
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

      // Find the sub-stage configuration
      const subStageConfig = umbrellaStage.subStages?.find(s => s.id === newSubStageId);
      
      // Map sub-stage ID back to legacy stage name
      let newStageName = umbrellaStage.name; // Default to umbrella stage name
      
      if (umbrellaStage.id === 'rejected') {
        // Rejected umbrella mapping
        if (newSubStageId === 'rejected') newStageName = 'Rejected';
        else if (newSubStageId === 'on-hold') newStageName = 'On Hold';
        else if (newSubStageId === 'profile-not-matched') newStageName = 'Profile Not Matched';
        else if (newSubStageId === 'last-minute-back-out') newStageName = 'Last Minute Back Out';
      } else if (umbrellaStage.id === 'interview') {
        // Interview umbrella - check for escalation
        if (subStageConfig?.escalationRule === 'move-to-stage' && subStageConfig.escalationTarget) {
          // Escalate to target stage
          const targetStage = DEFAULT_STAGE_CONFIG.mainStages.find(s => s.id === subStageConfig.escalationTarget);
          if (targetStage) {
            newStageName = targetStage.name;
          }
        } else {
          // Stay in Interview stage
          newStageName = 'Interview';
        }
      }

      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) return;

      // Only update if stage actually changed
      if (candidate.stage !== newStageName) {
        await onStageChange(candidateId, newStageName);
      }
    },
    [candidates, onStageChange, umbrellaStage]
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
              className="w-full max-w-7xl h-full max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
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
                className="flex items-center justify-between px-6 py-4 border-b border-gray-100"
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

              {/* Nested Kanban Board */}
              <div className="h-[calc(100%-73px)] overflow-hidden">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <div 
                    className="flex gap-4 h-full p-6 overflow-x-auto nested-kanban-scroll"
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
