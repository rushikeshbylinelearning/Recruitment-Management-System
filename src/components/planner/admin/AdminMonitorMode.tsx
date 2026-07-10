import { useState, useEffect } from 'react';
import { ChevronDown, Eye, Edit3 } from 'lucide-react';
import { plannerService } from '../../../services/plannerService';
import UserStatsPanel from './UserStatsPanel';

interface MonitorUser {
  id: number;
  name: string;
  role: string;
  email: string;
}

interface AdminMonitorModeProps {
  currentUserId: number;
  onViewingUserChange: (userId: number | null) => void;
}

export default function AdminMonitorMode({
  currentUserId,
  onViewingUserChange,
}: AdminMonitorModeProps) {
  const [users, setUsers] = useState<MonitorUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isManagement, setIsManagement] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    plannerService.getAdminUsers().then(setUsers).catch(() => {});
  }, []);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleSelect = (userId: number | null) => {
    setSelectedUserId(userId);
    onViewingUserChange(userId);
    setDropdownOpen(false);
    setIsManagement(false);
  };

  return (
    <div className="flex flex-col">
      {/* User switcher row */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors duration-150"
          >
            <Eye className="w-3.5 h-3.5" />
            {selectedUser ? `Viewing: ${selectedUser.name}` : 'My Planner'}
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-xl py-1">
              <button
                onClick={() => handleSelect(null)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${
                  !selectedUserId
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium'
                    : 'text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700'
                }`}
              >
                My Planner
              </button>
              {users.length > 0 && (
                <>
                  <div className="my-1 border-t border-gray-100 dark:border-neutral-700" />
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelect(u.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${
                        selectedUserId === u.id
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-medium'
                          : 'text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-1.5 text-xs text-gray-400 dark:text-neutral-500">
                        ({u.role})
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Management mode toggle (when viewing another user) */}
        {selectedUserId && (
          <button
            onClick={() => setIsManagement((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
              isManagement
                ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'border-gray-300 dark:border-neutral-600 text-gray-500 dark:text-neutral-400 hover:border-gray-400'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isManagement ? 'Management Mode' : 'Read Only'}
          </button>
        )}
      </div>

      {/* Viewing-as banner */}
      {selectedUser && (
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
          Viewing workspace of {selectedUser.name} · {isManagement ? 'Management mode (full edit)' : 'Read-only mode'}
        </div>
      )}

      {/* Stats panel */}
      {selectedUserId && (
        <div className="mt-2">
          <UserStatsPanel userId={selectedUserId} />
        </div>
      )}
    </div>
  );
}
