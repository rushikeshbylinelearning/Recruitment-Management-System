import { Suspense, lazy } from 'react';

const PlannerWorkspace = lazy(() =>
  import('../components/planner/PlannerWorkspace')
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3" />
      <p className="text-gray-500 dark:text-neutral-400 text-sm">Loading Planner…</p>
    </div>
  </div>
);

/**
 * PlannerPage renders inside DashboardLayout's <Outlet />.
 * The parent shell adds px-6 pt-5 pb-8 padding — we break out with
 * negative margins so PlannerWorkspace can take the full available height.
 */
export default function PlannerPage() {
  return (
    // Pull the planner out of the shell's padding so it fills edge-to-edge
    <div className="-mx-6 -mt-5 -mb-8 lg:-mx-4 lg:-mt-4 lg:-mb-6 xl:-mx-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        <PlannerWorkspace />
      </Suspense>
    </div>
  );
}
