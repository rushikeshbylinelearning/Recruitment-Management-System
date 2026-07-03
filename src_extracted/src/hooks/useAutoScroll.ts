/**
 * useAutoScroll Hook
 * 
 * Implements intelligent auto-scroll for drag operations
 * - Horizontal scroll when dragging near screen edges
 * - Vertical scroll when dragging near column edges
 * - Smooth acceleration based on proximity
 * - Immediate stop when cursor leaves trigger zone
 */

import { useEffect, useRef } from 'react';

interface AutoScrollConfig {
  boardRef: React.RefObject<HTMLDivElement>;
  columnRefs?: Map<string, React.RefObject<HTMLDivElement>> | React.RefObject<HTMLDivElement>[];
  isDragging: boolean;
  cursorPosition: { x: number; y: number } | null;
}

export const useAutoScroll = ({
  boardRef,
  columnRefs,
  isDragging,
  cursorPosition,
}: AutoScrollConfig) => {
  const rafId = useRef<number>();
  const scrollSpeed = useRef({ horizontal: 0, vertical: 0 });
  const getColumnRefs = () => {
    if (!columnRefs) return [] as React.RefObject<HTMLDivElement>[];
    return Array.isArray(columnRefs) ? columnRefs : Array.from(columnRefs.values());
  };

  useEffect(() => {
    const columnRefList = getColumnRefs();
    if (!isDragging || !cursorPosition || columnRefList.length === 0) {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      return;
    }

    const EDGE_THRESHOLD = 50;
    const MAX_SCROLL_SPEED = 20;

    const calculateSpeed = (distance: number): number => {
      if (distance > EDGE_THRESHOLD) return 0;
      return ((EDGE_THRESHOLD - distance) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED;
    };

    const animate = () => {
      // Horizontal scroll (board)
      const boardRect = boardRef.current?.getBoundingClientRect();
      if (boardRect) {
        const leftDistance = cursorPosition.x - boardRect.left;
        const rightDistance = boardRect.right - cursorPosition.x;

        if (leftDistance < EDGE_THRESHOLD) {
          scrollSpeed.current.horizontal = -calculateSpeed(leftDistance);
        } else if (rightDistance < EDGE_THRESHOLD) {
          scrollSpeed.current.horizontal = calculateSpeed(rightDistance);
        } else {
          scrollSpeed.current.horizontal = 0;
        }

        if (scrollSpeed.current.horizontal !== 0) {
          boardRef.current?.scrollBy({
            left: scrollSpeed.current.horizontal,
            behavior: 'auto',
          });
        }
      }

      // Vertical scroll (column)
      if (columnRefList.length > 0) {
        columnRefList.forEach((columnRef) => {
          const columnRect = columnRef.current?.getBoundingClientRect();
          if (!columnRect) return;

          // Check if cursor is over this column
          if (
            cursorPosition.x >= columnRect.left &&
            cursorPosition.x <= columnRect.right
          ) {
            const topDistance = cursorPosition.y - columnRect.top;
            const bottomDistance = columnRect.bottom - cursorPosition.y;

            if (topDistance < EDGE_THRESHOLD) {
              scrollSpeed.current.vertical = -calculateSpeed(topDistance);
            } else if (bottomDistance < EDGE_THRESHOLD) {
              scrollSpeed.current.vertical = calculateSpeed(bottomDistance);
            } else {
              scrollSpeed.current.vertical = 0;
            }

            if (scrollSpeed.current.vertical !== 0) {
              columnRef.current?.scrollBy({
                top: scrollSpeed.current.vertical,
                behavior: 'auto',
              });
            }
          }
        });
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isDragging, cursorPosition, boardRef, columnRefs]);
};
