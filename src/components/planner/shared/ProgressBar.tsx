interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

function getFillColour(pct: number): string {
  if (pct <= 33) return 'bg-red-500';
  if (pct <= 66) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  className = '',
  size = 'sm',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const fillColour = getFillColour(pct);

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${pct}% complete`}
    >
      <div
        className={`flex-1 rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden ${trackHeight}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-150 ease-out ${fillColour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-neutral-400 whitespace-nowrap tabular-nums">
          {pct}%
        </span>
      )}
    </div>
  );
}

export default ProgressBar;
