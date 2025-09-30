import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('dashboard');

  // Update active section based on current route
  React.useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) setActiveSection('dashboard');
    else if (path.startsWith('/jobs')) setActiveSection('jobs');
    else if (path.startsWith('/candidates')) setActiveSection('candidates');
    else if (path.startsWith('/interviews')) setActiveSection('interviews');
    else if (path.startsWith('/tasks')) setActiveSection('tasks');
    else if (path.startsWith('/team')) setActiveSection('team');
    else if (path.startsWith('/communications')) setActiveSection('communications');
    else if (path.startsWith('/assignments')) setActiveSection('assignments');
    else if (path.startsWith('/analytics')) setActiveSection('analytics');
    else if (path.startsWith('/settings')) setActiveSection('settings');
    else setActiveSection('dashboard');
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar 
        activeSection={activeSection}
        onSectionChange={(section) => {
          setActiveSection(section);
          // Navigation will be handled by the sidebar component
        }}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900 capitalize">
                {activeSection.replace('-', ' ')}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Profile */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{user?.name}</p>
                  <p className="text-gray-500">{user?.role}</p>
                </div>
              </div>
              
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
