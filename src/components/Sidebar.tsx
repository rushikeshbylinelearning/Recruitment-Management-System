import { Users, Briefcase, FileText, MessageSquare, BarChart3, Settings, Home, LogOut, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'interviews', label: 'Interviews', icon: Calendar },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: FileText },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    // Special handling for interviewer role
    if (user?.role === 'Interviewer') {
      return ['dashboard', 'jobs', 'candidates'].includes(item.id);
    }
    
    // Special handling for HR Manager and Recruiter roles - include interviews
    if (user?.role === 'HR Manager' || user?.role === 'Recruiter') {
      if (item.id === 'interviews') {
        return hasPermission('interviews', 'view');
      }
    }
    
    if (item.id === 'dashboard') return true;
    return hasPermission(item.id, 'view');
  });

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="w-64 bg-slate-900 text-white h-full flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-blue-400">RecruitPro</h1>
        <p className="text-sm text-slate-400 mt-1">Hiring Management</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onSectionChange(item.id);
                    navigate(`/${item.id}`);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.name.split(' ').map(n => n[0]).join('') || 'U'}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-400">{user?.role || 'Role'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-auto text-slate-400 hover:text-white transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}