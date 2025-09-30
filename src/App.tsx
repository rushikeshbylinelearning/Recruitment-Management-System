import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import InterviewerLayout from './components/InterviewerLayout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InterviewerDashboard from './components/InterviewerDashboard';
import Jobs from './components/Jobs';
import InterviewerJobs from './components/InterviewerJobs';
import Candidates from './components/Candidates';
import InterviewerCandidates from './components/InterviewerCandidates';
import InterviewerTest from './components/InterviewerTest';
import InterviewManagement from './components/InterviewManagement';
import Team from './components/Team';
import Tasks from './components/Tasks';
import Communications from './components/Communications';
import Assignments from './components/Assignments';
import Analytics from './components/Analytics';
import Settings from './components/Settings';

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

function AppContent() {
  const { isAuthenticated, user } = useAuth();

  // Debug logging
  console.log('AppContent - isAuthenticated:', isAuthenticated);
  console.log('AppContent - user:', user);
  console.log('AppContent - user role:', user?.role);

  return (
    <Routes>
      {/* Public Routes */}
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
          <Route path="interviews" element={<InterviewManagement showAllInterviews={true} />} />
          <Route path="team" element={<Team />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="communications" element={<Communications />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      )}
      
      {/* Catch all route - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
      <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

