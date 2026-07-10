import type { DrawerTab } from '../../../hooks/useTaskDrawer';
import { useAuth } from '../../../contexts/AuthContext';

const ALL_TABS: Array<{ id: DrawerTab; label: string; adminOnly?: boolean }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'notes', label: 'Notes' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
  { id: 'activity', label: 'Activity' },
  { id: 'history', label: 'History', adminOnly: true },
];

interface DrawerTabsProps {
  activeTab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
}

export default function DrawerTabs({ activeTab, onTabChange }: DrawerTabsProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const visibleTabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="flex border-b border-gray-200 dark:border-neutral-700 overflow-x-auto shrink-0">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all duration-150 ${
            activeTab === tab.id
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300'
          }`}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
