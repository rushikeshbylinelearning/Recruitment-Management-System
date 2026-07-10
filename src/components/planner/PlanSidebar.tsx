import { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Archive, Trash2, Check } from 'lucide-react';
import { Plan } from '../../services/plannerService';

const PRESET_COLOURS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

interface PlanSidebarProps {
  plans: Plan[];
  activePlanId: number | null;
  onSelectPlan: (id: number) => void;
  onCreatePlan: (data: { name: string; colour?: string }) => Promise<number | void>;
  onDeletePlan: (id: number) => Promise<void>;
  onArchivePlan: (id: number) => Promise<void>;
  isLoading: boolean;
  isAdmin?: boolean;
}

export default function PlanSidebar({
  plans,
  activePlanId,
  onSelectPlan,
  onCreatePlan,
  onDeletePlan,
  onArchivePlan,
  isLoading,
  isAdmin = false,
}: PlanSidebarProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanColour, setNewPlanColour] = useState(PRESET_COLOURS[0]);
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCreateForm) nameInputRef.current?.focus();
  }, [showCreateForm]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async () => {
    if (!newPlanName.trim()) return;
    setCreating(true);
    try {
      await onCreatePlan({ name: newPlanName.trim(), colour: newPlanColour });
      setNewPlanName('');
      setNewPlanColour(PRESET_COLOURS[0]);
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setShowCreateForm(false);
      setNewPlanName('');
    }
  };

  return (
    <aside className="flex flex-col w-60 shrink-0 h-full bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-700 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
          My Planner
        </span>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="p-1 rounded text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors duration-150"
          aria-label="Create new plan"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Create plan form */}
      {showCreateForm && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
          <input
            ref={nameInputRef}
            type="text"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Plan name…"
            maxLength={100}
            className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 mb-2"
          />
          {/* Colour picker */}
          <div className="flex gap-1.5 mb-2">
            {PRESET_COLOURS.map((c) => (
              <button
                key={c}
                onClick={() => setNewPlanColour(c)}
                className="w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-110"
                style={{ backgroundColor: c }}
                aria-label={`Select colour ${c}`}
              >
                {newPlanColour === c && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newPlanName.trim() || creating}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewPlanName(''); }}
              className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plan list */}
      <nav className="flex-1 px-2 pb-4">
        {isLoading ? (
          // Loading skeleton
          <div className="space-y-1 mt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-8 rounded-md bg-gray-200 dark:bg-neutral-700" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-neutral-500 text-center mt-6 px-2">
            No plans yet.<br />Create your first plan.
          </p>
        ) : (
          <ul className="space-y-0.5 mt-1">
            {plans.map((plan) => (
              <li key={plan.id} className="group relative">
                <button
                  onClick={() => onSelectPlan(plan.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-left transition-colors duration-150 ${
                    activePlanId === plan.id
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium'
                      : 'text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {/* Colour dot */}
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: plan.colour || '#6B7280' }}
                  />
                  <span className="truncate flex-1 min-w-0">
                    <span className="block truncate">{plan.name}</span>
                    {isAdmin && plan.owner_name && (
                      <span className="block truncate text-xs text-gray-400 dark:text-neutral-500 font-normal">
                        {plan.owner_name}
                      </span>
                    )}
                  </span>
                  {plan.is_archived && (
                    <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">archived</span>
                  )}
                </button>

                {/* Context menu trigger */}
                <div ref={openMenuId === plan.id ? menuRef : undefined}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === plan.id ? null : plan.id);
                    }}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors duration-150 ${
                      openMenuId === plan.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label={`Plan options for ${plan.name}`}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {openMenuId === plan.id && (
                    <div className="absolute right-0 top-8 z-50 w-40 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg py-1">
                      {!plan.is_archived && (
                        <button
                          onClick={() => { onArchivePlan(plan.id); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors duration-150"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archive
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) {
                            onDeletePlan(plan.id);
                          }
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
