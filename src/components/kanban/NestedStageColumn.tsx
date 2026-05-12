import { memo, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import CandidateCard from './CandidateCard';
import { Candidate as ApiCandidate } from '../../services/api';
import { SubStage } from '../../types/umbrellaStage';

interface NestedStageColumnProps {
  subStage: SubStage;
  candidates: ApiCandidate[];
  accentColor: string;
  onCandidateClick: (candidate: ApiCandidate) => void;
  onCandidateEdit: (candidate: ApiCandidate) => void;
  onCandidateDelete: (candidateId: string) => void;
  onDownloadResume: (candidateId: string) => void;
  onOpenNotes?: (candidate: ApiCandidate) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  isDragging: boolean;
  isOver?: boolean;
  syncingCards?: Set<string>;
  candidateAssignments?: Map<string, { status: string; deadline: string; emailFailed: boolean }>;
  umbrellaStageId?: string; // To identify which umbrella this belongs to
}

const NestedStageColumn = memo(
  function NestedStageColumn({
    subStage,
    candidates,
    accentColor,
    onCandidateClick,
    onCandidateEdit,
    onCandidateDelete,
    onDownloadResume,
    onOpenNotes,
    hasEditPermission,
    hasDeletePermission,
    isDragging,
    isOver = false,
    syncingCards = new Set(),
    candidateAssignments,
    umbrellaStageId,
  }: NestedStageColumnProps) {
    const { setNodeRef, isOver: isOverDnd } = useDroppable({ id: subStage.id });
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

    return (
      <div
        className="flex-shrink-0 w-80 flex flex-col overflow-hidden"
        role="region"
        aria-label={`${subStage.name} column, ${safeCandidates.length} candidates`}
        data-substage={subStage.id}
      >
        {/* Column Header */}
        <div className="flex flex-col gap-1 px-4 py-3 mb-3 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-800">{subStage.name}</h3>
              {/* Escalation Badge */}
              {subStage.escalationRule === 'move-to-stage' && subStage.escalationTarget && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Auto-escalate
                </span>
              )}
            </div>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              aria-label={`${safeCandidates.length} candidates`}
            >
              {safeCandidates.length}
            </span>
          </div>
          {subStage.description && (
            <p className="text-xs text-gray-500">{subStage.description}</p>
          )}
          {/* Escalation Info */}
          {subStage.escalationRule === 'move-to-stage' && subStage.escalationTarget && (
            <p className="text-xs text-blue-600 font-medium mt-1">
              → Moves to {subStage.escalationTarget.charAt(0).toUpperCase() + subStage.escalationTarget.slice(1)}
            </p>
          )}
        </div>

        {/* Drop Zone */}
        <div
          ref={(node) => {
            setNodeRef(node);
            localScrollRef.current = node;
          }}
          className={`relative flex-1 min-h-0 rounded-xl p-3 overflow-y-auto overflow-x-hidden transition-all duration-200 ${
            isDropTarget
              ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-dashed border-indigo-300 shadow-inner'
              : 'bg-gray-50/40 border-2 border-transparent'
          }`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${accentColor}40 transparent`,
          }}
          aria-dropeffect={isDropTarget ? 'move' : 'none'}
        >
          {safeCandidates.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center h-64 transition-all duration-200 rounded-lg ${
                isDropTarget ? 'scale-105' : ''
              }`}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${
                  isDropTarget ? 'scale-110' : ''
                }`}
                style={{
                  backgroundColor: isDropTarget ? `${accentColor}25` : `${accentColor}10`,
                }}
              >
                <span
                  className="text-3xl font-bold"
                  style={{ color: accentColor }}
                >
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
                    <div className="mb-3" data-card-id={candidate.id}>
                      <CandidateCard
                        candidate={candidate}
                        accentColor={accentColor}
                        onClick={onCandidateClick}
                        onEdit={onCandidateEdit}
                        onDelete={onCandidateDelete}
                        onDownloadResume={onDownloadResume}
                        onOpenNotes={onOpenNotes}
                        hasEditPermission={hasEditPermission}
                        hasDeletePermission={hasDeletePermission}
                        isSyncing={isSyncing}
                        assignmentStatus={candidateAssignments?.get(candidate.id)?.status}
                        assignmentDeadline={candidateAssignments?.get(candidate.id)?.deadline}
                        emailFailed={candidateAssignments?.get(candidate.id)?.emailFailed}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default NestedStageColumn;
