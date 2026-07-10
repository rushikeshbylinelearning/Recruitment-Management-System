import { Suspense, lazy } from 'react';

const CalendarWorkspace = lazy(() => import('../components/calendar/CalendarWorkspace'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3" />
      <p className="text-gray-500 dark:text-neutral-400 text-sm">Loading Calendar…</p>
    </div>
  </div>
);

export default function CalendarPage() {
  return (
    <div className="-mx-6 -mt-5 -mb-8 lg:-mx-4 lg:-mt-4 lg:-mb-6 xl:-mx-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        <CalendarWorkspace />
      </Suspense>
    </div>
  );
}
