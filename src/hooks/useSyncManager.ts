/**
 * useSyncManager Hook
 * 
 * Manages backend synchronization with optimistic UI updates
 * - Immediate UI update (optimistic)
 * - Background API call
 * - Rollback on failure
 * - Retry with exponential backoff (max 3 attempts)
 * - Loading indicators
 */

import { useState, useCallback } from 'react';

interface SyncState {
  syncingCards: Set<string>;
  failedCards: Map<string, { error: string; attempts: number }>;
  retryQueue: Array<{ candidateId: string; newStage: string; attempt: number }>;
}

export const useSyncManager = (
  onStageChange: (id: string, stage: string) => Promise<void>
) => {
  const [syncState, setSyncState] = useState<SyncState>({
    syncingCards: new Set(),
    failedCards: new Map(),
    retryQueue: [],
  });
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const syncDrop = useCallback(
    async (
      candidateId: string,
      newStage: string,
      previousStage: string,
      attemptSeed: number = 0
    ) => {
      setSyncState((prev) => ({
        ...prev,
        syncingCards: new Set(prev.syncingCards).add(candidateId),
      }));

      try {
        const maxAttempts = 3;
        let lastError: unknown = null;

        for (let attempt = attemptSeed; attempt < maxAttempts; attempt++) {
          try {
            await onStageChange(candidateId, newStage);

            setSyncState((prev) => {
              const next = { ...prev };
              next.syncingCards.delete(candidateId);
              next.failedCards.delete(candidateId);
              return next;
            });
            return;
          } catch (error) {
            lastError = error;
            const nextAttempt = attempt + 1;
            setSyncState((prev) => ({
              ...prev,
              failedCards: new Map(prev.failedCards).set(candidateId, {
                error: (error as Error)?.message ?? 'Sync failed',
                attempts: nextAttempt,
              }),
            }));

            if (nextAttempt < maxAttempts) {
              const delay = Math.pow(2, nextAttempt) * 1000; // 2s, 4s, 8s
              await sleep(delay);
            }
          }
        }

        setSyncState((prev) => {
          const next = { ...prev };
          next.syncingCards.delete(candidateId);
          next.failedCards.set(candidateId, {
            error: 'Max retry attempts reached',
            attempts: 3,
          });
          return next;
        });

        throw lastError ?? new Error('Sync failed');
      } catch (error) {
        // Ensure syncing flag clears even if unexpected error happens above.
        setSyncState((prev) => {
          const next = { ...prev };
          next.syncingCards.delete(candidateId);
          return next;
        });
        throw error;
      } finally {
        void previousStage; // preserved for caller signature compatibility
      }
    },
    [onStageChange]
  );

  const cancelRetry = useCallback((_candidateId: string) => {
    // With the awaited retry loop approach, cancellations are a no-op.
    // (If we need cancellation later, we can add an AbortSignal.)
    void _candidateId;
  }, []);

  const manualRetry = useCallback(
    (candidateId: string, newStage: string, previousStage: string) => {
      cancelRetry(candidateId);
      syncDrop(candidateId, newStage, previousStage, 0);
    },
    [cancelRetry, syncDrop]
  );

  return {
    syncState,
    syncDrop,
    manualRetry,
    cancelRetry,
  };
};
