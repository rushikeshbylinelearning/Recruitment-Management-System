import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DrawerProvider } from './contexts/DrawerContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import InterviewerLayout from './components/InterviewerLayout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import GlobalDrawerManager from './components/GlobalDrawerManager';
import NotificationPermissionBanner from './components/NotificationPermissionBanner';
import PublicFormPage from './pages/PublicFormPage';
import PublicApplicationPage from './pages/PublicApplicationPage';
import PublicLandingPage from './pages/PublicLandingPage';
import SubmissionPage from './pages/SubmissionPage';
import PublicPortalGuard from './components/routing/PublicPortalGuard';
import { isPublicPortal, shouldSegregatePortals } from './utils/domain';

const InterviewerDashboard = lazy(() => import('./components/InterviewerDashboard'));
const Jobs = lazy(() => import('./components/Jobs'));
const InterviewerJobs = lazy(() => import('./components/InterviewerJobs'));
const Candidates = lazy(() => import('./components/CandidatesNew'));
const InterviewerCandidates = lazy(() => import('./components/InterviewerCandidates'));
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
const PlannerPage = lazy(() => import('./pages/PlannerPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-brand-black">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-neutral-400 font-medium">Loading...</p>
    </div>
  </div>
);

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'Interviewer') return <InterviewerDashboard />;
  return <Dashboard />;
}

function RoleBasedJobs() {
  const { user } = useAuth();
  if (user?.role === 'Interviewer') return <InterviewerJobs />;
  return <Jobs />;
}

function RoleBasedCandidates() {
  const { user } = useAuth();
  if (user?.role === 'Interviewer') return <InterviewerCandidates />;
  return <Candidates />;
}

function RoleBasedInterviews() {
  const { user } = useAuth();
  if (user?.role === 'Recruiter') return <RecruiterInterview />;
  return <InterviewManagement />;
}

/** apply.bylinelms.com — public applications only; no HR shell. */
function PublicPortalRoutes() {
  return (
    <PublicPortalGuard>
      <Routes>
        <Route path="/" element={<PublicLandingPage />} />
        <Route path="/apply/:slug" element={<PublicFormPage />} />
        <Route path="/a/:shortCode" element={<PublicApplicationPage />} />
        <Route path="/j/:shortCode" element={<PublicApplicationPage />} />
        <Route path="/c/:shortCode" element={<PublicApplicationPage />} />
        <Route path="/submit-assignment/:candidateId/:token" element={<SubmissionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PublicPortalGuard>
  );
}

/** hr.bylinelms.com — ATS + legacy public paths (redirect to apply when applicable). */
function HRPortalRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {user?.role === 'Interviewer' ? (
        <Route path="/" element={<ProtectedRoute><InterviewerLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<InterviewerDashboard />} />
          <Route path="candidates" element={<InterviewerCandidates />} />
        </Route>
      ) : (
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
          <Route path="planner" element={<PlannerPage />} />
          <Route path="planner/task/:taskId" element={<PlannerPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      )}

      {/* Legacy public URLs on HR host — still work; PublicFormPage may redirect to apply domain */}
      <Route path="/apply/:slug" element={<PublicFormPage />} />
      <Route path="/a/:shortCode" element={<PublicApplicationPage />} />
      <Route path="/j/:shortCode" element={<PublicApplicationPage />} />
      <Route path="/c/:shortCode" element={<PublicApplicationPage />} />
      <Route path="/submit-assignment/:candidateId/:token" element={<SubmissionPage />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

/** localhost without ?portal= — all routes (existing dev behavior). */
function UnifiedDevRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route path="/apply/:slug" element={<PublicFormPage />} />
      <Route path="/a/:shortCode" element={<PublicApplicationPage />} />
      <Route path="/j/:shortCode" element={<PublicApplicationPage />} />
      <Route path="/c/:shortCode" element={<PublicApplicationPage />} />
      <Route path="/submit-assignment/:candidateId/:token" element={<SubmissionPage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {user?.role === 'Interviewer' ? (
        <Route path="/" element={<ProtectedRoute><InterviewerLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<InterviewerDashboard />} />
          <Route path="candidates" element={<InterviewerCandidates />} />
        </Route>
      ) : (
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
          <Route path="planner" element={<PlannerPage />} />
          <Route path="planner/task/:taskId" element={<PlannerPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      )}

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const segregate = shouldSegregatePortals();
  const onPublicPortal = isPublicPortal();

  let routeTree: React.ReactNode;
  if (segregate && onPublicPortal) {
    routeTree = <PublicPortalRoutes />;
  } else if (segregate) {
    routeTree = <HRPortalRoutes />;
  } else {
    routeTree = <UnifiedDevRoutes />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      {routeTree}
      {isAuthenticated && !onPublicPortal && <GlobalDrawerManager />}
      {isAuthenticated && !onPublicPortal && <NotificationPermissionBanner />}
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <DrawerProvider>
        <Router>
          <NotificationProvider>
            <div className="App min-h-screen bg-gray-50 dark:bg-brand-black">
              <AppContent />
            </div>
          </NotificationProvider>
        </Router>
      </DrawerProvider>
    </AuthProvider>
  );
}

export default App;
