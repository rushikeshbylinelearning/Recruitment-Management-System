import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DrawerProvider } from './contexts/DrawerContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import InterviewerLayout from './components/InterviewerLayout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import FloatingNoteButton from './components/FloatingNoteButton';
import GlobalDrawerManager from './components/GlobalDrawerManager';
import PublicFormPage from './pages/PublicFormPage';
import SubmissionPage from './pages/SubmissionPage';

// Lazy load heavy components
const InterviewerDashboard = lazy(() => import('./components/InterviewerDashboard'));
const Jobs = lazy(() => import('./components/Jobs'));
const InterviewerJobs = lazy(() => import('./components/InterviewerJobs'));
const Candidates = lazy(() => import('./components/CandidatesNew'));
const InterviewerCandidates = lazy(() => import('./components/InterviewerCandidates'));
const InterviewerTest = lazy(() => import('./components/InterviewerTest'));
const InterviewManagement = lazy(() => import('./components/InterviewManagement'));
const RecruiterInterview = lazy(() => import('./components/RecruiterInterview'));
const Team = lazy(() => import('./components/Team'));
const Tasks = lazy(() => import('./components/Tasks'));
const Communications = lazy(() => import('./components/Communications'));
const Assignments = lazy(() => import('./components/Assignments'));
const Analytics = lazy(() => import('./components/Analytics'));
const Settings = lazy(() => import('./components/Settings'));
const FormBuilder = lazy(() => import('./components/FormBuilder'));
const WorkflowBuilder = lazy(() => import('./components/WorkflowBuilder'));
const RecruiterMonitor = lazy(() => import('./components/RecruiterMonitor'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-96">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

// Role-based component wrapper
function RoleBasedDashboard() {
  const { user } = useAuth();
  
  if (user?.role === 'Interviewer') {
    return <InterviewerDashboard />;
  }
  
  return <Dashboard />;
}

function RoleBasedJobs() {
  const { user } = useAuth();
  
  if (user?.role === 'Interviewer') {
    return <InterviewerJobs />;
  }
  
  return <Jobs />;
}

function RoleBasedCandidates() {
  const { user } = useAuth();
  
  if (user?.role === 'Interviewer') {
    return <InterviewerCandidates />;
  }
  
  return <Candidates />;
}

function RoleBasedInterviews() {
  const { user } = useAuth();
  
  if (user?.role === 'Recruiter') {
    return <RecruiterInterview />;
  }
  
  return <InterviewManagement />;
}

function AppContent() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Suspense fallback={<LoadingFallback />}>
    <Routes>
      {/* Public Routes */}
      <Route path="/apply/:slug" element={<PublicFormPage />} />
      <Route path="/submit-assignment/:candidateId/:token" element={<SubmissionPage />} />
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      
      {/* Interviewer Routes */}
      {user?.role === 'Interviewer' ? (
        <Route path="/" element={<ProtectedRoute><InterviewerLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<InterviewerDashboard />} />
          <Route path="candidates" element={<InterviewerCandidates />} />
        </Route>
      ) : (
        /* Regular User Routes */
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<RoleBasedDashboard />} />
          <Route path="jobs" element={<RoleBasedJobs />} />
          <Route path="candidates" element={<RoleBasedCandidates />} />
          <Route path="interviewer-jobs" element={<InterviewerJobs />} />
          <Route path="interviewer-candidates" element={<InterviewerCandidates />} />
          <Route path="interviews" element={<RoleBasedInterviews />} />
          <Route path="team" element={<Team />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="communications" element={<Communications />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="form-builder" element={<FormBuilder />} />
          <Route path="workflows" element={<WorkflowBuilder />} />
          <Route path="recruiter-monitor" element={<RecruiterMonitor />} />
        </Route>
      )}
      
      {/* Catch all route - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    {/* Universal floating note button — visible on all authenticated pages */}
    {/* TEMPORARILY DISABLED: {isAuthenticated && user?.role !== 'Interviewer' && <FloatingNoteButton />} */}
    {/* Global drawer manager for context-aware drawers */}
    {isAuthenticated && <GlobalDrawerManager />}
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <DrawerProvider>
        <Router>
          <div className="App">
            <AppContent />
          </div>
        </Router>
      </DrawerProvider>
    </AuthProvider>
  );
}

export default App;

