import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Search, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';
import NotificationBell from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';

// ─── Z-Index Scale ────────────────────────────────────────────────────────────
//  z-0   page content (default flow)
//  z-30  sidebar panel
//  z-40  header / topbar
//  z-50  modals, drawers, dropdowns  ← all `fixed inset-0` overlays land here
//  z-70  sidebar toggle button
//
// CRITICAL RULES that make this work:
//  1. The root <div> must NOT set z-index (no stacking context at root level).
//  2. The main-area wrapper must NOT use overflow:hidden — that creates a
//     stacking context that traps fixed children and causes modals to compete
//     with the header at the wrong layer.
//  3. The header uses position:sticky (not relative) so it scrolls with the
//     content column and does NOT create a z-index stacking context that
//     would occlude modals.
//  4. All `position:fixed` modals paint in the root browsing-context stacking
//     context — they always beat a sticky/relative header as long as no
//     ancestor creates a new stacking context via overflow, transform, or
//     will-change.
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return (
      localStorage.getItem('darkMode') === 'true' ||
      (!localStorage.getItem('darkMode') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  React.useEffect(() => {
    const path = location.pathname;
    if      (path.startsWith('/dashboard'))          setActiveSection('dashboard');
    else if (path.startsWith('/jobs'))               setActiveSection('jobs');
    else if (path.startsWith('/candidates'))         setActiveSection('candidates');
    else if (path.startsWith('/interviews'))         setActiveSection('interviews');
    else if (path.startsWith('/analytics'))          setActiveSection('analytics');
    else if (path.startsWith('/team'))               setActiveSection('team');
    else if (path.startsWith('/communications'))     setActiveSection('communications');
    else if (path.startsWith('/assignments'))        setActiveSection('assignments');
    else if (path.startsWith('/tasks'))              setActiveSection('tasks');
    else if (path.startsWith('/form-builder'))       setActiveSection('form-builder');
    else if (path.startsWith('/settings'))           setActiveSection('settings');
    else                                              setActiveSection('dashboard');

    setGlobalSearchTerm('');
  }, [location.pathname]);

  const sidebarWidth = collapsed ? '4rem' : '16rem';

  return (
    // ── Root: NO z-index, NO overflow:hidden, NO transform ─────────────────
    // Any of those would create a stacking context that traps fixed children.
    <div
      className="flex h-screen bg-gray-50 dark:bg-[#050d1a]"
      style={{ '--sidebar-width': sidebarWidth } as React.CSSProperties}
    >

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {/* z-30: background panel, below header and modals */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
        style={{ position: 'relative', zIndex: 30 }}
      >
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(section) => setActiveSection(section)}
          collapsed={collapsed}
        />
      </div>

      {/* ── Sidebar Toggle Button ─────────────────────────────────────────── */}
      {/* position:fixed + z-70: escapes ALL stacking contexts, always on top */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex items-center justify-center w-6 h-6 rounded-full
                   transition-all duration-300 ease-in-out hover:scale-110
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        style={{
          position: 'fixed',
          left: 'calc(var(--sidebar-width) - 0.75rem)',
          top: '1.5rem',
          zIndex: 70,
          background: 'linear-gradient(135deg, #2563eb, #1e40af)',
          boxShadow: '0 0 12px rgba(37,99,235,0.5)',
        }}
      >
        {collapsed
          ? <ChevronRight size={12} className="text-white" />
          : <ChevronLeft  size={12} className="text-white" />}
      </button>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      {/*
        KEY FIX vs previous version:
        - Removed `overflow-hidden` — it was creating a stacking context that
          trapped `position:fixed` modal backdrops inside this div, forcing
          them to compete with the header at z-40 instead of painting above
          everything in the root stacking context.
        - The main content column scrolls via overflow-auto on <main> below,
          not via overflow:hidden here.
        - No z-index on this wrapper — it must NOT create a stacking context.
      */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Header / Topbar ──────────────────────────────────────────── */}
        {/*
          position:sticky keeps the header visible while scrolling.
          z-40: above sidebar (30) and page content, below modals (50) and
          toggle button (70).

          IMPORTANT: backdrop-filter alone creates a stacking context, but
          because modals use position:fixed and their z-index is evaluated in
          the ROOT stacking context (not inside any ancestor), z-50 modals
          will always paint above this z-40 header regardless.

          We do NOT use `position:relative` + `z-index` combo on any ancestor
          div, which is what was causing the original clip.
        */}
        <header
          className="shadow-sm border-b px-4 py-2 dark:border-[#1a2f52] flex-shrink-0"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            backgroundColor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <style>{`
            html.dark .dashboard-topbar {
              background-color: rgba(10,22,40,0.95) !important;
            }
          `}</style>
          <div className="dashboard-topbar flex items-center justify-between">
            {/* Page Title */}
            <div>
              <h1 className="text-lg font-bold capitalize text-gray-900 dark:text-[#e2e8f0]">
                {activeSection.replace('-', ' ')}
              </h1>
              <p className="text-xs mt-0 text-gray-500 dark:text-[#475569]">
                {activeSection === 'dashboard'         && 'Overview of your recruitment process'}
                {activeSection === 'candidates'        && 'Manage and track all candidates'}
                {activeSection === 'jobs'              && 'Active job postings and positions'}
                {activeSection === 'interviews'        && 'Schedule and manage interviews'}
                {activeSection === 'analytics'         && 'Insights and performance metrics'}
                {activeSection === 'team'              && 'Manage your hiring team members and their performance'}
                {activeSection === 'communications'    && 'Track all candidate communications and follow-ups'}
                {activeSection === 'assignments'       && 'Manage candidate assignments and tasks'}
                {activeSection === 'tasks'             && 'Track and manage recruitment tasks'}
                {activeSection === 'form-builder'      && 'Create and manage custom forms'}
                {activeSection === 'workflows'         && 'Automate your recruitment workflows'}
                {activeSection === 'recruiter-monitor' && 'Monitor recruiter performance and activities'}
                {activeSection === 'settings'          && 'Configure your recruitment system preferences'}
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-2">
              {/* Global Search */}
              <div className="relative hidden md:block">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#475569]"
                  size={16}
                />
                <input
                  type="text"
                  placeholder={
                    activeSection === 'candidates' ? 'Search candidates...' : 'Quick search...'
                  }
                  value={globalSearchTerm}
                  onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 w-56 rounded-lg text-sm transition-all
                    border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400
                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300
                    dark:border-[#1a2f52] dark:bg-[#0f1f3d] dark:text-[#e2e8f0] dark:placeholder-[#334155]
                    dark:focus:ring-[#2563eb] dark:focus:border-[#2563eb]"
                />
              </div>

              <NotificationBell />

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode((v) => !v)}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-1.5 rounded-lg transition-all hover:bg-gray-100 text-gray-600
                  dark:hover:bg-[#0f1f3d] dark:text-[#64748b] dark:hover:text-[#e2e8f0]
                  dark:border dark:border-[#1a2f52]"
              >
                {darkMode ? (
                  <Sun size={16} className="text-[#2563eb]" />
                ) : (
                  <Moon size={16} />
                )}
              </button>

              {/* User Profile */}
              <div className="flex items-center space-x-2 px-2 py-1 rounded-lg transition-all cursor-pointer
                hover:bg-gray-100 dark:hover:bg-[#0f1f3d] dark:border dark:border-[#1a2f52]">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}
                >
                  <span className="text-white text-xs font-semibold">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="text-xs hidden lg:block">
                  <p className="font-semibold text-gray-900 dark:text-[#e2e8f0]">{user?.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-[#475569]">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Content ─────────────────────────────────────────────── */}
        {/*
          overflow-auto here (not on parent) — this is the scroll container.
          No z-index needed; content sits at natural z:0 in the flow.
        */}
        <main className="flex-1 overflow-auto flex flex-col min-h-0 bg-gray-50 dark:bg-[#050d1a]">
          <ErrorBoundary>
            {/* flex-1 + min-h-0 lets pages like the Kanban board fill remaining height without creating outer scroll */}
            <div className="flex-1 flex flex-col min-h-0 h-full px-6 pt-5 pb-6">
              <Outlet context={{ globalSearchTerm, setGlobalSearchTerm }} />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}