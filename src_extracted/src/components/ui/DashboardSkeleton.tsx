/** Skeleton layout matching the dashboard (no full-screen overlay). */
export default function DashboardSkeleton() {
  const bar = 'bg-gray-200/90 dark:bg-[#333333] rounded-lg';
  const barSm = 'bg-gray-100 dark:bg-[#152a4a] rounded';

  return (
    <div className="space-y-6" aria-hidden="true" aria-busy="true">
      <div className="rounded-2xl p-8 mb-8 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-950/50 dark:to-purple-950/50">
        <div className={`h-8 w-64 ${bar} mb-3`} />
        <div className={`h-4 w-96 max-w-full ${barSm}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#333333] p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 space-y-2">
                <div className={`h-3 w-20 ${barSm}`} />
                <div className={`h-8 w-16 ${bar}`} />
              </div>
              <div className="w-14 h-14 rounded-xl bg-gray-200 dark:bg-[#333333]" />
            </div>
            <div className={`h-3 w-28 ${barSm}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#262626] rounded-2xl border border-gray-200 dark:border-[#333333] p-6">
          <div className={`h-6 w-40 ${bar} mb-6`} />
          <div className="space-y-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <div className={`h-3 w-24 ${barSm}`} />
                  <div className={`h-3 w-8 ${barSm}`} />
                </div>
                <div className="h-3 rounded-full bg-gray-100 dark:bg-[#152a4a] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gray-200 dark:bg-[#333333]"
                    style={{ width: `${72 - i * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#262626] rounded-2xl border border-gray-200 dark:border-[#333333] p-6">
          <div className={`h-6 w-36 ${bar} mb-6`} />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#171717]">
                <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-[#333333] mt-2 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className={`h-3 w-full ${barSm}`} />
                  <div className={`h-2 w-2/3 ${barSm}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
