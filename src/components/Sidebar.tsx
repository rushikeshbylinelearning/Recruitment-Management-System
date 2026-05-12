import { useState, useEffect } from 'react';
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
    if (item.id === 'recruiter-monitor') return user?.role === 'Admin';
    if (user?.role === 'HR Manager') {
      if (item.id === 'interviews') return hasPermission('interviews', 'view');
    }
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

  return (
    // ─── Stacking-context note ───────────────────────────────────────────────
    // No z-index is set on this wrapper. Stacking is managed at the
    // DashboardLayout level so the toggle button (rendered there with
    // position:fixed / z-[70]) sits cleanly above both the sidebar and the
    // header without any stacking-context conflicts.
    // ────────────────────────────────────────────────────────────────────────
    <div
      className={`relative flex flex-col h-full shadow-xl transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-64'
      } ${!isHydrated ? 'sidebar-not-hydrated' : ''}`}
      style={{ background: 'linear-gradient(180deg, #050d1a 0%, #071224 60%, #0a1628 100%)' }}
    >
      {/* Subtle blue left-edge glow */}
      <div
        className="absolute inset-y-0 right-0 w-px pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, #1a2f52 30%, #1a2f52 70%, transparent)' }}
      />

      {/* Logo */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center p-4' : 'space-x-3 p-5'}`}
        style={{ borderBottom: '1px solid #1a2f52' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
            boxShadow: '0 0 16px rgba(37,99,235,0.4)',
          }}
        >
          <Briefcase size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold leading-tight" style={{ color: '#e2e8f0' }}>
              Byline HR
            </h1>
            <p className="text-xs" style={{ color: '#334155' }}>
              Recruitment Portal
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-0.5 px-2">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onSectionChange(item.id);
                    navigate(`/${item.id}`);
                  }}
                  title={collapsed && isHydrated ? item.label : undefined}
                  className="w-full flex items-center rounded-lg transition-all duration-150"
                  style={{
                    padding: collapsed ? '10px' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: collapsed ? 0 : 12,
                    background: isActive
                      ? 'linear-gradient(135deg, #1e3a63 0%, #162847 100%)'
                      : 'transparent',
                    borderLeft: isActive ? '2px solid #2563eb' : '2px solid transparent',
                    color: isActive ? '#e2e8f0' : '#475569',
                    boxShadow: isActive ? '0 0 12px rgba(37,99,235,0.15)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#0f1f3d';
                      (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                    }
                  }}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && (
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

      {/* User Profile */}
      <div
        className={`p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}
        style={{ borderTop: '1px solid #1a2f52' }}
      >
        <div
          className={`flex items-center rounded-lg ${
            collapsed ? 'justify-center p-2' : 'space-x-2 px-3 py-2'
          }`}
          style={{ background: '#0a1628' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}
          >
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#e2e8f0' }}>
                {user?.name || 'User'}
              </p>
              <p className="text-xs truncate" style={{ color: '#334155' }}>
                {user?.role || 'Role'}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: '#334155' }}
              title={isHydrated ? 'Logout' : undefined}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
                (e.currentTarget as HTMLButtonElement).style.background = '#162847';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#334155';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={logout}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#334155' }}
            title={isHydrated ? 'Logout' : undefined}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
              (e.currentTarget as HTMLButtonElement).style.background = '#162847';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#334155';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </div>
  );
}