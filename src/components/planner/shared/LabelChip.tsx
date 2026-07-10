import { X } from 'lucide-react';

interface LabelChipProps {
  name: string;
  colour: string;
  onRemove?: () => void;
  className?: string;
}

export function LabelChip({ name, colour, onRemove, className = '' }: LabelChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white transition-all duration-150 ${className}`}
      style={{ backgroundColor: colour }}
      aria-label={`Label: ${name}`}
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRemove();
            }
          }}
          tabIndex={0}
          className="ml-0.5 flex items-center rounded-full hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-colors duration-150"
          aria-label={`Remove ${name} label`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

export default LabelChip;
