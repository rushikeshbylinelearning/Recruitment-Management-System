import { memo, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import CandidateCard from './CandidateCard';
import { Candidate as ApiCandidate } from '../../services/api';
import { UmbrellaStage } from '../../types/umbrellaStage';

interface UmbrellaStageColumnProps {
  stage: UmbrellaStage;
  candidates: ApiCandidate[];
  onCandidateClick: (candidate: ApiCandidate) => void;
  onCandidateEdit: (candidate: ApiCandidate) => void;
  onCandidateDelete: (candidateId: string) => void;
  onDownloadResume: (candidateId: string) => void;
  onOpenNotes?: (candidate: ApiCandidate) => void;
  onStageChange?: (candidateId: string, newStage: string) => void;
  availableStages?: string[];
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  isDragging: boolean;
  isOver?: boolean;
  dropIndex?: number | null;
  syncingCards?: Set<string>;
  candidateAssignments?: Map<string, { status: string; deadline: string; emailFailed: boolean }>;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (candidateId: string) => void;
  onExpandUmbrella?: () => void;
}

const UmbrellaStageColumn = memo(
  function UmbrellaStageColumn({
    stage,
    candidates,
    onCandidateClick,
    onCandidateEdit,
    onCandidateDelete,
    onDownloadResume,
    onOpenNotes,
    onStageChange,
    availableStages = [],
    hasEditPermission,
    hasDeletePermission,
    isDragging,
    isOver = false,
    dropIndex = null,
    syncingCards = new Set(),
    candidateAssignments,
    selectionMode = false,
    selectedIds = new Set(),
    onToggleSelect = () => {},
    onExpandUmbrella,
  }: UmbrellaStageColumnProps) {
    const { setNodeRef, isOver: isOverDnd } = useDroppable({ id: stage.id });
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    const isDropTarget = (isOver || isOverDnd) && isDragging;

    const localScrollRef = useRef<HTMLDivElement | null>(null);

    const virtualizer = useVirtualizer({
      count: safeCandidates.length,
      getScrollElement: () => localScrollRef.current,
      estimateSize: () => 120,
      overscan: 3,
      measureElement:
        typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
          ? (element) => element?.getBoundingClientRect().height
          : undefined,
    });

    const virtualItems = virtualizer.getVirtualItems();

    // Calculate sub-stage breakdown for umbrella stages
    const subStageBreakdown = stage.isUmbrella && stage.subStages
      ? stage.subStages.map(subStage => {
          let count = 0;

          if (stage.id === 'rejected') {
            // Map sub-stage id → legacy stage name for counting
            const legacyMap: Record<string, string> = {
              'rejected':             'Rejected',
              'on-hold':              'On Hold',
              'profile-not-matched':  'Profile Not Matched',
              'last-minute-back-out': 'Last Minute Back Out',
            };
            const legacyName = legacyMap[subStage.id];
            if (legacyName) {
              count = safeCandidates.filter(c => c.stage === legacyName).length;
            }
          } else if (stage.id === 'interview') {
            // Use sub_stage field if available, otherwise fall back to even distribution
            const hasSubStage = safeCandidates.some((c: any) => c.sub_stage);
            if (hasSubStage) {
              count = safeCandidates.filter((c: any) => c.sub_stage === subStage.id).length;
            } else {
              count = Math.floor(safeCandidates.length / (stage.subStages?.length || 1));
            }
          } else if (stage.id === 'follow-up') {
            // Use sub_stage field for no-response; rest have no sub-stage
            if (subStage.id === 'no-response') {
              count = safeCandidates.filter((c: any) => c.sub_stage === 'no-response').length;
            } else {
              count = safeCandidates.filter((c: any) => !c.sub_stage || c.sub_stage === '').length;
            }
          }

          return { ...subStage, count };
        })
      : [];

    return (
      <div
        className="flex-shrink-0 w-72 flex flex-col overflow-hidden kanban-column"
        role="region"
        aria-label={`${stage.name} column, ${safeCandidates.length} candidates`}
        data-stage={stage.id}
      >
        {/* Column Header */}
        <motion.div
          className={`relative z-20 flex items-center justify-between px-3 py-2 mb-2 bg-white rounded-lg border border-gray-100 ${
            stage.isUmbrella ? 'cursor-pointer hover:shadow-md hover:border-gray-200' : ''
          } transition-all duration-200`}
          onClick={stage.isUmbrella ? onExpandUmbrella : undefined}
          whileHover={stage.isUmbrella ? { scale: 1.01 } : {}}
          whileTap={stage.isUmbrella ? { scale: 0.99 } : {}}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.accentColor }}
            />
            <h3 className="text-sm font-bold text-gray-800">{stage.name}</h3>
            {stage.isUmbrella && (
              <ChevronRight
                size={16}
                className="text-gray-400 transition-transform duration-200"
              />
            )}
          </div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: `${stage.accentColor}15`, color: stage.accentColor }}
            aria-label={`${safeCandidates.length} candidates`}
          >
            {safeCandidates.length}
          </span>
        </motion.div>

        {/* Sub-stage Summary Panel (for umbrella stages) */}
        {stage.isUmbrella && subStageBreakdown.length > 0 && (
          <motion.div
            className="mb-2 px-3 py-2 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-100"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="space-y-1.5">
              {subStageBreakdown.map((subStage) => (
                <div
                  key={subStage.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-gray-600 font-medium">{subStage.name}</span>
                  <span
                    className="font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${stage.accentColor}10`,
                      color: stage.accentColor,
                    }}
                  >
                    {subStage.count}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Drop Zone */}
        <div
          ref={(node) => {
            setNodeRef(node);
            localScrollRef.current = node;
          }}
          className={`relative z-0 flex-1 min-h-0 rounded-lg p-2 overflow-y-auto overflow-x-hidden transition-all duration-200 ${
            isDropTarget
              ? 'bg-gray-50 border border-dashed border-gray-300'
              : 'bg-gray-50/60 border border-transparent'
          }`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${stage.accentColor}40 transparent`,
            overscrollBehavior: 'contain',
          }}
          aria-dropeffect={isDropTarget ? 'move' : 'none'}
        >
          {safeCandidates.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center h-48 transition-all duration-200 ${
                isDropTarget ? 'scale-105 bg-indigo-100' : 'bg-gray-50'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all ${
                  isDropTarget ? 'bg-indigo-200 scale-110' : 'bg-gray-100'
                }`}
                style={{
                  backgroundColor: isDropTarget ? `${stage.accentColor}30` : `${stage.accentColor}12`,
                }}
              >
                <span className="text-2xl font-bold" style={{ color: stage.accentColor }}>
                  +
                </span>
              </div>
              <p
                className={`text-sm font-medium transition-colors ${
                  isDropTarget ? 'text-indigo-700' : 'text-gray-400'
                }`}
              >
                {isDropTarget ? 'Drop here' : 'No candidates'}
              </p>
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualItem) => {
                const candidate = safeCandidates[virtualItem.index];
                const isSyncing = syncingCards.has(candidate.id);
                const showPlaceholderBefore =
                  dropIndex !== null && dropIndex === virtualItem.index && isDragging;

                return (
                  <div
                    key={candidate.id}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {showPlaceholderBefore && (
                      <div className="h-28 border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50/50 flex items-center justify-center animate-fade-in mb-2.5">
                        <span className="text-sm font-medium text-indigo-600">Drop here</span>
                      </div>
                    )}

                    <div className="mb-2.5" data-card-id={candidate.id}>
                      {selectionMode && (
                        <label
                          className="flex items-center gap-2 px-2 pb-1 cursor-pointer select-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelect(candidate.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(candidate.id)}
                            onChange={() => onToggleSelect(candidate.id)}
                            className="w-4 h-4 rounded accent-red-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">Select</span>
                        </label>
                      )}
                      <div
                        className={
                          selectionMode && selectedIds.has(candidate.id)
                            ? 'ring-2 ring-red-400 rounded-xl'
                            : ''
                        }
                      >
                        <CandidateCard
                          candidate={candidate}
                          accentColor={stage.accentColor}
                          onClick={
                            selectionMode ? () => onToggleSelect(candidate.id) : onCandidateClick
                          }
                          onEdit={onCandidateEdit}
                          onDelete={onCandidateDelete}
                          onDownloadResume={onDownloadResume}
                          onOpenNotes={onOpenNotes}
                          onStageChange={onStageChange}
                          availableStages={availableStages}
                          hasEditPermission={hasEditPermission}
                          hasDeletePermission={hasDeletePermission}
                          isSyncing={isSyncing}
                          assignmentStatus={candidateAssignments?.get(candidate.id)?.status}
                          assignmentDeadline={candidateAssignments?.get(candidate.id)?.deadline}
                          emailFailed={candidateAssignments?.get(candidate.id)?.emailFailed}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {dropIndex !== null && dropIndex >= safeCandidates.length && isDragging && (
                <div
                  style={{
                    position: 'absolute',
                    top: virtualizer.getTotalSize(),
                    left: 0,
                    width: '100%',
                  }}
                >
                  <div className="h-28 border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50/50 flex items-center justify-center animate-fade-in">
                    <span className="text-sm font-medium text-indigo-600">Drop here</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default UmbrellaStageColumn;
