import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Briefcase, FileText, MessageSquare, BarChart3, Settings,
  Home, LogOut, Calendar, ClipboardList, FormInput, Zap,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  collapsed: boolean;
}

export default function Sidebar({ activeSection, onSectionChange, collapsed }: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);

  const menuItems = [
    { id: 'dashboard',         label: 'Dashboard',         icon: Home },
    { id: 'jobs',              label: 'Jobs',               icon: Briefcase },
    { id: 'candidates',        label: 'Candidates',         icon: Users },
    { id: 'interviews',        label: 'Interviews',         icon: Calendar },
    { id: 'team',              label: 'Team',               icon: Users },
    { id: 'tasks',             label: 'Tasks',              icon: FileText },
    { id: 'communications',    label: 'Communications',     icon: MessageSquare },
    { id: 'assignments',       label: 'Assignments',        icon: ClipboardList },
    { id: 'analytics',         label: 'Analytics',          icon: BarChart3 },
    { id: 'form-builder',      label: 'Form Builder',       icon: FormInput },
    { id: 'workflows',         label: 'Workflows',          icon: Zap },
    { id: 'recruiter-monitor', label: 'Recruiter Monitor',  icon: Activity },
    { id: 'settings',          label: 'Settings',           icon: Settings },
  ];

  const filteredMenuItems = menuItems.filter((item) => {
    if (user?.role === 'Interviewer') return ['dashboard', 'jobs', 'candidates'].includes(item.id);
    if (user?.role === 'HR Intern') return ['dashboard', 'jobs', 'candidates', 'interviews', 'tasks', 'form-builder'].includes(item.id);
    if (item.id === 'recruiter-monitor') return user?.role === 'Admin';
    if (user?.role?.toLowerCase() === 'recruiter') {
      if (item.id === 'interviews') return true;
    }
    if (item.id === 'dashboard') return true;
    return hasPermission(item.id, 'view');
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const initials = user?.name?.split(' ').map((n) => n[0]).join('') || 'U';

  const getCollapsedLabel = (item: { id: string; label: string }) => {
    const short: Record<string, string> = {
      'form-builder': 'Forms',
      communications: 'Comms',
      assignments: 'Assign',
      'recruiter-monitor': 'Monitor',
    };
    return short[item.id] ?? item.label;
  };

  return (
    <aside
      className={`relative flex flex-col h-full w-full overflow-visible transition-all duration-300 ease-out sidebar-glass ${
        !isHydrated ? 'sidebar-not-hydrated' : ''
      }`}
    >
      <div
        className="absolute inset-y-0 right-0 w-px pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(239,68,68,0.5) 35%, rgba(239,68,68,0.5) 65%, transparent)',
        }}
      />

      <div
        className={`sidebar-brand-row shrink-0 ${collapsed ? 'sidebar-brand-row--collapsed' : ''}`}
      >
        <div className={`flex items-center min-w-0 flex-1 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="sidebar-logo">
            <Briefcase size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-tight text-white tracking-tight">
                Byline HR
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Recruitment Portal
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-premium ${collapsed ? 'py-1.5 px-0.5' : 'py-3 px-2'}`}>
        <ul className={collapsed ? 'space-y-0' : 'space-y-1'}>
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id} className="relative">
                {isActive && !collapsed && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                {isActive && collapsed && (
                  <div className="absolute inset-0 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm" />
                )}
                <button
                  onClick={() => {
                    onSectionChange(item.id);
                    navigate(`/${item.id}`);
                  }}
                  title={!collapsed && isHydrated ? item.label : undefined}
                  className={`relative z-[1] w-full rounded-xl transition-colors duration-200 ${
                    collapsed
                      ? 'sidebar-nav-item--collapsed flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 min-h-[3rem]'
                      : 'flex items-center gap-3 px-3 py-2.5'
                  } ${
                    isActive
                      ? 'text-red-500'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  <Icon
                    size={collapsed ? 18 : 18}
                    strokeWidth={isActive ? 2.25 : 2}
                    className="flex-shrink-0"
                  />
                  {collapsed ? (
                    <span className="sidebar-nav-label-collapsed sidebar-nav-label">
                      {getCollapsedLabel(item)}
                    </span>
                  ) : (
                    <span className="text-sm font-medium truncate sidebar-nav-label">
                      {item.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={`shrink-0 border-t border-white/10 ${collapsed ? 'flex flex-col items-center gap-1 p-1.5' : 'p-3'}`}
      >
        <div
          className={`flex items-center rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 ${
            collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5'
          }`}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-red-500 to-red-700 shadow-md shadow-red-900/40">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-white">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] truncate text-slate-500">
                {user?.role || 'Role'}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
              title={isHydrated ? 'Logout' : undefined}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={logout}
            className="flex flex-col items-center gap-1 py-2 px-1 w-full rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            title={isHydrated ? 'Logout' : undefined}
          >
            <LogOut size={16} />
            <span className="sidebar-nav-label-collapsed">Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}
