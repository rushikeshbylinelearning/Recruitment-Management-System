import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Search, Moon, Sun } from 'lucide-react';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';
import NotificationBell from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    // Restore persisted preference
    return localStorage.getItem('darkMode') === 'true' ||
      (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Apply / remove `dark` class on <html> whenever darkMode changes
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

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
    else if (path.startsWith('/form-builder')) setActiveSection('form-builder');
    else if (path.startsWith('/settings')) setActiveSection('settings');
    else setActiveSection('dashboard');
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#050d1a]">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={(section) => {
          setActiveSection(section);
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header
          className="backdrop-blur-md shadow-sm border-b px-6 py-4 bg-white/80 dark:border-[#1a2f52]"
          style={{ backgroundColor: 'var(--topbar-bg, rgba(255,255,255,0.8))' }}
        >
          <style>{`
            html.dark header { background-color: rgba(10,22,40,0.95) !important; }
          `}</style>
          <div className="flex items-center justify-between">
            {/* Page Title */}
            <div>
              <h1 className="text-2xl font-bold capitalize text-gray-900 dark:text-[#e2e8f0]">
                {activeSection.replace('-', ' ')}
              </h1>
              <p className="text-sm mt-0.5 text-gray-500 dark:text-[#475569]">
                {activeSection === 'dashboard' && 'Overview of your recruitment process'}
                {activeSection === 'candidates' && 'Manage and track all candidates'}
                {activeSection === 'jobs' && 'Active job postings and positions'}
                {activeSection === 'interviews' && 'Schedule and manage interviews'}
                {activeSection === 'analytics' && 'Insights and performance metrics'}
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
              {/* Global Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#475569]" size={18} />
                <input
                  type="text"
                  placeholder="Quick search..."
                  className="pl-10 pr-4 py-2 w-64 rounded-xl text-sm transition-all
                    border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400
                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300
                    dark:border-[#1a2f52] dark:bg-[#0f1f3d] dark:text-[#e2e8f0] dark:placeholder-[#334155]
                    dark:focus:ring-[#2563eb] dark:focus:border-[#2563eb]"
                />
              </div>

              {/* Notifications */}
              <NotificationBell />

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode((v) => !v)}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-xl transition-all
                  hover:bg-gray-100 text-gray-600
                  dark:hover:bg-[#0f1f3d] dark:text-[#64748b] dark:hover:text-[#e2e8f0]
                  dark:border dark:border-[#1a2f52]"
              >
                {darkMode ? (
                  <Sun size={18} className="text-[#2563eb]" />
                ) : (
                  <Moon size={18} />
                )}
              </button>

              {/* User Profile */}
              <div className="flex items-center space-x-3 px-3 py-2 rounded-xl transition-all cursor-pointer
                hover:bg-gray-100
                dark:hover:bg-[#0f1f3d] dark:border dark:border-[#1a2f52]">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}>
                  <span className="text-white text-sm font-semibold">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="text-sm hidden lg:block">
                  <p className="font-semibold text-gray-900 dark:text-[#e2e8f0]">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#475569]">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto px-6 py-5 bg-gray-50 dark:bg-[#050d1a]">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
