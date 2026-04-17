import { memo, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import CandidateCard from './CandidateCard';
import { Candidate as ApiCandidate } from '../../services/api';

interface KanbanColumnProps {
  stage: string;
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
  dropIndex?: number | null;
  syncingCards?: Set<string>;
  candidateAssignments?: Map<string, { status: string; deadline: string; emailFailed: boolean }>;
}

const KanbanColumn = memo(
  function KanbanColumn({
    stage,
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
    dropIndex = null,
    syncingCards = new Set(),
    candidateAssignments,
  }: KanbanColumnProps) {
    const { setNodeRef, isOver: isOverDnd } = useDroppable({ id: stage });
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    const isDropTarget = (isOver || isOverDnd) && isDragging;

    // Local ref for virtualization
    const localScrollRef = useRef<HTMLDivElement | null>(null);

    // Virtualization for large lists
    const virtualizer = useVirtualizer({
      count: safeCandidates.length,
      getScrollElement: () => localScrollRef.current,
      estimateSize: () => 120, // Estimated card height
      overscan: 3, // Render 3 extra items above/below viewport
      measureElement:
        typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
          ? (element) => element?.getBoundingClientRect().height
          : undefined,
    });

    const virtualItems = virtualizer.getVirtualItems();

    return (
      <div
        className="flex-shrink-0 w-72 flex flex-col overflow-hidden kanban-column"
        role="region"
        aria-label={`${stage} column, ${safeCandidates.length} candidates`}
        data-stage={stage}
      >
        {/* Column Header */}
        <div className="relative z-20 flex items-center justify-between px-3 py-2 mb-2 bg-white rounded-lg border border-gray-100">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <h3 className="text-sm font-bold text-gray-800">{stage}</h3>
          </div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
            aria-label={`${safeCandidates.length} candidates`}
          >
            {safeCandidates.length}
          </span>
        </div>

        {/* Drop Zone - FIXED: setNodeRef must be called on this element */}
        <div
          ref={(node) => {
            // Set the droppable ref first
            setNodeRef(node);
            // Then set the local scroll ref
            localScrollRef.current = node;
          }}
          className={`relative z-0 flex-1 rounded-lg p-2 min-h-[520px] max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
            isDropTarget
              ? 'bg-gray-50 border border-dashed border-gray-300'
              : 'bg-gray-50/60 border border-transparent'
          }`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${accentColor}40 transparent`,
          }}
          aria-dropeffect={isDropTarget ? 'move' : 'none'}
        >
          {safeCandidates.length === 0 ? (
            // Empty column placeholder
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
                  backgroundColor: isDropTarget ? `${accentColor}30` : `${accentColor}12`,
                }}
              >
                <span className="text-2xl font-bold" style={{ color: accentColor }}>
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
            // Virtualized candidate list
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
                    {/* Drop placeholder */}
                    {showPlaceholderBefore && (
                      <div
                        className="h-28 border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50/50 flex items-center justify-center animate-fade-in mb-2.5"
                      >
                        <span className="text-sm font-medium text-indigo-600">Drop here</span>
                      </div>
                    )}

                    <div className="mb-2.5" data-card-id={candidate.id}>
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

              {/* Drop placeholder at end */}
              {dropIndex !== null &&
                dropIndex >= safeCandidates.length &&
                isDragging && (
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
  },
  (prev, next) => {
    if (
      prev.stage !== next.stage ||
      prev.isDragging !== next.isDragging ||
      prev.isOver !== next.isOver ||
      prev.dropIndex !== next.dropIndex ||
      prev.hasEditPermission !== next.hasEditPermission ||
      prev.hasDeletePermission !== next.hasDeletePermission ||
      prev.accentColor !== next.accentColor
    )
      return false;

    const a = Array.isArray(prev.candidates) ? prev.candidates : [];
    const b = Array.isArray(next.candidates) ? next.candidates : [];
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (
        a[i].id !== b[i].id ||
        a[i].stage !== b[i].stage ||
        a[i].name !== b[i].name ||
        a[i].email !== b[i].email ||
        a[i].phone !== b[i].phone ||
        a[i].position !== b[i].position
      )
        return false;
    }

    // Check syncing cards
    if (prev.syncingCards?.size !== next.syncingCards?.size) return false;

    // Check candidateAssignments map — must re-render when assignment statuses change
    if (prev.candidateAssignments !== next.candidateAssignments) return false;

    return true;
  }
);

export default KanbanColumn;