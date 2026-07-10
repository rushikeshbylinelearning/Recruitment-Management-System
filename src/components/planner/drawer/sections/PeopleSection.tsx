/**
 * PeopleSection — Section 2 of the left panel
 *
 * Displays avatar chips for: Assigned To, Assigned By (creator),
 * and any other relevant people fields from the task record.
 *
 * Uses existing task data already fetched by the parent — no additional API calls.
 */

import { memo } from 'react';
import type { TaskDetail } from '../../../../services/plannerService';
import { getInitials } from '../TaskDetailModal';

// ─── Avatar chip ──────────────────────────────────────────────────────────────

interface AvatarChipProps {
  name: string | null | undefined;
  role: string;
  colorClass?: string;
}

function AvatarChip({ name, role, colorClass = 'bg-red-600' }: AvatarChipProps) {
  if (!name) return null;
  const initials = getInitials(name);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-gray-200 dark:hover:border-neutral-600 transition-colors duration-150 group">
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full ${colorClass} text-white text-xs font-bold flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-neutral-800`}
        aria-hidden="true"
        title={name}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">
          {name}
        </p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{role}</p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PeopleSectionProps {
  task: TaskDetail;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-red-600',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-600',
  'bg-amber-500',
];

function colorForIndex(i: number) {
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

export default memo(function PeopleSection({ task }: PeopleSectionProps) {
  const people: Array<{ name: string | null | undefined; role: string; colorIndex: number }> = [
    {
      name: task.assignee_name as string | undefined,
      role: 'Assigned To',
      colorIndex: 0,
    },
    {
      name: (task.assigner_name as string | undefined) ?? (task.created_by_name as string | undefined),
      role: 'Assigned By',
      colorIndex: 1,
    },
  ].filter((p) => Boolean(p.name));

  if (people.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-neutral-500 italic">
        No people assigned yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {people.map((person, i) => (
        <AvatarChip
          key={`${person.role}-${i}`}
          name={person.name}
          role={person.role}
          colorClass={colorForIndex(person.colorIndex)}
        />
      ))}
    </div>
  );
});
