import { useState, useEffect, useCallback } from 'react';
import { plannerService, Plan } from '../services/plannerService';

const STORAGE_KEY = 'planner_active_plan_id';

/**
 * @param targetUserId - When provided (Admin monitor mode), loads that user's
 *                       workspace via the admin API instead of the own plans.
 */
export function usePlanner(targetUserId?: number) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanIdState] = useState<number | null>(() => {
    // Don't restore persisted plan when viewing another user's workspace
    if (targetUserId != null) return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActivePlanId = useCallback((id: number | null) => {
    setActivePlanIdState(id);
    // Only persist to localStorage for own workspace
    if (targetUserId == null) {
      if (id != null) localStorage.setItem(STORAGE_KEY, String(id));
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, [targetUserId]);

  const fetchPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let data: Plan[];

      if (targetUserId != null) {
        // Admin monitor mode: fetch target user's workspace
        const workspace = await plannerService.getAdminWorkspace(targetUserId);
        data = (workspace.plans as Plan[]) ?? [];
      } else {
        data = await plannerService.getPlans();
      }

      setPlans(data);

      // Auto-select first plan
      if (data.length > 0) {
        if (targetUserId != null) {
          // Always start at first plan when viewing another user
          setActivePlanId(data[0].id);
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          const storedId = stored ? parseInt(stored, 10) : null;
          const exists = storedId != null && data.some((p) => p.id === storedId);
          if (!exists) setActivePlanId(data[0].id);
        }
      } else {
        setActivePlanId(null);
      }
    } catch {
      setError('Failed to load plans. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, setActivePlanId]);

  useEffect(() => {
    // Reset plan selection when target user changes
    setActivePlanIdState(null);
    fetchPlans();
  }, [fetchPlans]);

  const createPlan = useCallback(
    async (data: { name: string; colour?: string; description?: string }) => {
      const id = await plannerService.createPlan(data);
      await fetchPlans();
      setActivePlanId(id);
      return id;
    },
    [fetchPlans, setActivePlanId]
  );

  const updatePlan = useCallback(
    async (id: number, data: Partial<Plan>) => {
      await plannerService.updatePlan(id, data);
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    },
    []
  );

  const deletePlan = useCallback(
    async (id: number) => {
      await plannerService.deletePlan(id);
      setPlans((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (activePlanId === id) {
          setActivePlanId(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
    },
    [activePlanId, setActivePlanId]
  );

  const archivePlan = useCallback(async (id: number) => {
    await plannerService.archivePlan(id);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, is_archived: true } : p)));
    if (activePlanId === id) {
      const remaining = plans.filter((p) => p.id !== id && !p.is_archived);
      setActivePlanId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [activePlanId, plans, setActivePlanId]);

  const restorePlan = useCallback(async (id: number) => {
    await plannerService.restorePlan(id);
    await fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    activePlanId,
    setActivePlanId,
    createPlan,
    updatePlan,
    deletePlan,
    archivePlan,
    restorePlan,
    isLoading,
    error,
    refetch: fetchPlans,
  };
}
