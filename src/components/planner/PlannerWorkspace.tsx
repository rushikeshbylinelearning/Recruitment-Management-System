import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { usePlanner } from '../../hooks/usePlanner';
import { useTaskDrawer } from '../../hooks/useTaskDrawer';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import PlanSidebar from './PlanSidebar';
import PlannerHeader, { ViewMode } from './PlannerHeader';
import BoardView from './views/BoardView';
import GridView from './views/GridView';
import TaskDrawer from './drawer/TaskDrawer';
import { PlannerFilters } from './filters/FilterPanel';

const CalendarWorkspace = lazy(() => import('../calendar/CalendarWorkspace'));

export default function PlannerWorkspace() {
  const { planId: urlPlanId } = useParams<{ planId?: string }>();
  const { user } = useAuth();

  // Admin monitor mode: which user's workspace is being viewed (null = own workspace)
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);

  const {
    plans,
    activePlanId,
    setActivePlanId,
    createPlan,
    deletePlan,
    archivePlan,
    isLoading,
    error,
  } = usePlanner(viewingUserId ?? undefined);

  const { isOpen, activeTaskId, activeTab, openTask, closeDrawer, setActiveTab } = useTaskDrawer();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('planner_view_mode') as ViewMode) || 'board';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<PlannerFilters>({});
  const [boardKey, setBoardKey] = useState(0); // force view remount on plan change
  const [boardRefreshKey, setBoardRefreshKey] = useState(0); // silent data refresh without remount

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('planner_view_mode', viewMode);
  }, [viewMode]);

  // Sync URL param → active plan
  useEffect(() => {
    if (urlPlanId) {
      const id = parseInt(urlPlanId, 10);
      if (!isNaN(id)) setActivePlanId(id);
    }
  }, [urlPlanId, setActivePlanId]);

  // Remount view when active plan changes
  useEffect(() => {
    setBoardKey((k) => k + 1);
    setBoardRefreshKey(0);
  }, [activePlanId]);

  const activePlan = plans.find((p) => p.id === activePlanId);

  const handleTaskUpdated = useCallback(() => {
    setBoardRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-white dark:bg-neutral-900">
      {/* ── Plan sidebar ─────────────────────────────────────────────── */}
      <PlanSidebar
        plans={plans}
        activePlanId={activePlanId}
        onSelectPlan={setActivePlanId}
        onCreatePlan={createPlan}
        onDeletePlan={deletePlan}
        onArchivePlan={archivePlan}
        isLoading={isLoading}
        isAdmin={user?.role === 'Admin'}
      />

      {/* ── Main area ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-gray-50 dark:bg-neutral-950">
        {error && (
          <div className="m-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="p-6 space-y-3">
            <div className="animate-pulse h-8 w-52 bg-gray-200 dark:bg-neutral-700 rounded" />
            <div className="animate-pulse h-4 w-32 bg-gray-100 dark:bg-neutral-800 rounded" />
          </div>
        ) : (
          <>
            {/* ── Shared header — always rendered for all three views ── */}
            <PlannerHeader
              planName={activePlan?.name ?? ''}
              viewMode={viewMode}
              onViewChange={setViewMode}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
              onViewingUserChange={user?.role === 'Admin' ? (uid) => {
                setViewingUserId(uid);
                setActivePlanId(null);
              } : undefined}
            />

            {/* ── Content area — swaps per view, header never moves ─── */}
            {viewMode === 'calendar' ? (
              /* Calendar view: fills remaining height, CalendarWorkspace
                 renders without its own header (hideHeader=true) so only
                 its sub-toolbar (Today/nav/Month-Week-Day/+New) appears   */
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-neutral-400 text-sm">Loading Calendar…</p>
                    </div>
                  </div>
                }>
                  <CalendarWorkspace hideHeader />
                </Suspense>
              </div>
            ) : activePlan ? (
              <div className="flex-1 overflow-hidden">
                {viewMode === 'board' && (
                  <BoardView
                    key={boardKey}
                    planId={activePlan.id}
                    refreshKey={boardRefreshKey}
                    onTaskClick={openTask}
                  />
                )}
                {viewMode === 'grid' && (
                  <GridView
                    key={boardKey}
                    planId={activePlan.id}
                    refreshKey={boardRefreshKey}
                    onTaskClick={openTask}
                  />
                )}
              </div>
            ) : plans.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-xs">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📋</span>
                  </div>
                  {viewingUserId ? (
                    <p className="font-semibold text-gray-700 dark:text-neutral-300">This user has no plans yet.</p>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-700 dark:text-neutral-300">No plans yet</p>
                      <p className="mt-1 text-sm text-gray-400 dark:text-neutral-500">
                        Click the <strong>+</strong> button in the sidebar to create your first plan.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400 dark:text-neutral-500 text-sm">
                  Select a plan from the sidebar to get started.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Task modal — board & grid views only ─────────────────────── */}
      {viewMode !== 'calendar' && (
        <TaskDrawer
          isOpen={isOpen}
          taskId={activeTaskId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={closeDrawer}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}
