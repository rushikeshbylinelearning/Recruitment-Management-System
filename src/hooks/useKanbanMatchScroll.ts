import { useEffect, useRef } from 'react';
import { Candidate as ApiCandidate } from '../services/api';
import { DEFAULT_STAGE_CONFIG } from '../types/umbrellaStage';

function getMainStageCandidateCounts(
  candidatesByStage: Record<string, ApiCandidate[]>
): { id: string; count: number }[] {
  return DEFAULT_STAGE_CONFIG.mainStages.map((stageConfig) => {
    let count = 0;
    if (stageConfig.isUmbrella) {
      if (stageConfig.id === 'rejected') {
        for (const s of ['Rejected', 'On Hold', 'Profile Not Matched', 'Last Minute Back Out']) {
          count += (candidatesByStage[s] || []).length;
        }
      } else if (stageConfig.id === 'interview') {
        count = (candidatesByStage['Interview'] || []).length;
      } else if (stageConfig.id === 'follow-up') {
        count = (candidatesByStage['Follow Up'] || []).length;
      }
    } else {
      count = (candidatesByStage[stageConfig.name] || []).length;
    }
    return { id: stageConfig.id, count };
  });
}

function isColumnMostlyVisible(col: HTMLElement, board: HTMLElement): boolean {
  const boardRect = board.getBoundingClientRect();
  const colRect = col.getBoundingClientRect();
  const pad = 12;
  return colRect.left >= boardRect.left - pad && colRect.right <= boardRect.right + pad;
}

function scrollBoardToRevealColumns(board: HTMLElement, columns: HTMLElement[]) {
  if (columns.length === 0) return;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

  const viewWidth = board.clientWidth;
  if (viewWidth <= 0) return;

  if (columns.length === 1) {
    const col = columns[0];
    const target = col.offsetLeft - (viewWidth - col.offsetWidth) / 2;
    board.scrollTo({ left: Math.max(0, target), behavior });
    return;
  }

  const first = columns[0];
  const last = columns[columns.length - 1];
  const firstLeft = first.offsetLeft;
  const lastRight = last.offsetLeft + last.offsetWidth;

  const scrollToShowFirst = Math.max(0, firstLeft);
  const scrollToShowLast = Math.max(0, lastRight - viewWidth);

  if (scrollToShowLast <= scrollToShowFirst) {
    const centered = Math.max(0, (firstLeft + lastRight - viewWidth) / 2);
    board.scrollTo({ left: centered, behavior });
    return;
  }

  const boardRect = board.getBoundingClientRect();
  let hiddenLeft = 0;
  let hiddenRight = 0;
  for (const col of columns) {
    const r = col.getBoundingClientRect();
    if (r.right < boardRect.left + 8) hiddenLeft += 1;
    else if (r.left > boardRect.right - 8) hiddenRight += 1;
  }

  if (hiddenRight > hiddenLeft) {
    board.scrollTo({ left: scrollToShowLast, behavior });
  } else if (hiddenLeft > hiddenRight) {
    board.scrollTo({ left: scrollToShowFirst, behavior });
  } else if (hiddenRight > 0) {
    board.scrollTo({ left: scrollToShowLast, behavior });
  } else if (hiddenLeft > 0) {
    board.scrollTo({ left: scrollToShowFirst, behavior });
  } else if (!isColumnMostlyVisible(last, board)) {
    board.scrollTo({ left: scrollToShowLast, behavior });
  } else if (!isColumnMostlyVisible(first, board)) {
    board.scrollTo({ left: scrollToShowFirst, behavior });
  }
}

interface UseKanbanMatchScrollOptions {
  boardRef: React.RefObject<HTMLDivElement>;
  candidatesByStage: Record<string, ApiCandidate[]>;
  enabled: boolean;
  isDragging: boolean;
  overlayOpen: boolean;
}

/**
 * When search/filters narrow results, scroll the kanban board so columns that
 * still contain matches are brought into view (especially far-right stages).
 */
export function useKanbanMatchScroll({
  boardRef,
  candidatesByStage,
  enabled,
  isDragging,
  overlayOpen,
}: UseKanbanMatchScrollOptions) {
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!enabled) {
      lastSignatureRef.current = '';
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isDragging || overlayOpen) return;

    const withMatches = getMainStageCandidateCounts(candidatesByStage).filter((c) => c.count > 0);
    if (withMatches.length === 0) return;

    const signature = withMatches.map((c) => `${c.id}:${c.count}`).join('|');
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    const board = boardRef.current;
    if (!board) return;

    const run = () => {
      const columnEls: HTMLElement[] = [];
      for (const { id } of withMatches) {
        const el = board.querySelector(`[data-kanban-stage="${id}"]`) as HTMLElement | null;
        if (el) columnEls.push(el);
      }
      if (columnEls.length === 0) return;

      columnEls.sort((a, b) => a.offsetLeft - b.offsetLeft);

      if (columnEls.every((col) => isColumnMostlyVisible(col, board))) return;

      scrollBoardToRevealColumns(board, columnEls);
    };

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(frame);
  }, [boardRef, candidatesByStage, enabled, isDragging, overlayOpen]);
}
