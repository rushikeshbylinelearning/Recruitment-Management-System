import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
// import rateLimit from 'express-rate-limit'; // DISABLED
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config/config.js';
import { testConnection } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import jobRoutes from './routes/jobs.js';
import candidateRoutes from './routes/candidates.js';
import candidateMergeRoutes from './routes/candidateMerge.js';
import { ensureMergeSchema } from './services/ensureMergeSchema.js';
import interviewRoutes from './routes/interviews.js';
import taskRoutes from './routes/tasks.js';
import communicationRoutes from './routes/communications.js';
import emailTemplateRoutes from './routes/emailTemplates.js';
import analyticsRoutes from './routes/analytics.js';
import hiringTrendsRoutes from './routes/hiringTrends.js';
import settingsRoutes from './routes/settings.js';
import fileRoutes from './routes/files.js';
import dashboardRoutes from './routes/dashboard.js';
import assignmentRoutes from './routes/assignments.js';
import candidateAssignmentRoutes from './routes/candidateAssignments.js';
import automationRoutes from './routes/automations.js';
import activityLogRoutes from './routes/activityLogs.js';
import workflowRoutes from './routes/workflows.js';
import publicFormRoutes from './routes/publicForms.js';
import publicApplicationRoutes from './routes/publicApplication.js';
import candidateApplicationsRoutes from './routes/candidateApplications.js';
import { ensurePublicApplicationSchema } from './services/ensurePublicApplicationSchema.js';
import publicSubmissionRoutes from './routes/publicSubmission.js';
import formBuilderRoutes from './routes/formBuilder.js';
import notificationsRouter from './routes/notifications.js';
import taskUpdatesRouter from './routes/taskUpdates.js';
import candidateNotesRoutes from './routes/candidateNotes.js';
import interactionMemoryRoutes from './routes/interactionMemory.js';
import candidateImportRoutes from './routes/candidateImport.js';
import { startNotificationCron, startAssignmentNotificationCron } from './services/notificationCron.js';
import { startPlannerDailyResetCron } from './services/plannerCron.js';
import rmsExportRoutes from './routes/rmsExport.js';
import plannerRoutes from './routes/planner/index.js';
import calendarRoutes from './routes/calendar/index.js';
import emailService from './services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Behind Apache/nginx — trust X-Forwarded-* for protocol/host in share links
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors(config.cors));

// Rate limiting - DISABLED
// const limiter = rateLimit({
//   windowMs: config.rateLimit.windowMs,
//   max: config.rateLimit.maxRequests,
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again later.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/', limiter);

// Compression middleware
app.use(compression());

// Logging middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: dbConnected ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/candidates/import', candidateImportRoutes);
app.use('/api/candidates/merge', candidateMergeRoutes);
app.use('/api/candidates/hiring-trends', hiringTrendsRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/candidate-assignments', candidateAssignmentRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/public', publicApplicationRoutes); // Short-link public applications (no auth)
app.use('/api/public', publicFormRoutes); // Legacy /apply/:slug routes (no auth)
app.use('/api/public/submit-assignment', publicSubmissionRoutes); // Public submission routes (no auth)
app.use('/api/form-builder', formBuilderRoutes); // Admin form builder routes (auth required)
app.use('/api/candidate-applications', candidateApplicationsRoutes);
app.use('/api/notifications', notificationsRouter);
app.use('/api/task-updates', taskUpdatesRouter);
app.use('/api/candidate-notes', candidateNotesRoutes);
app.use('/api/interaction', interactionMemoryRoutes);
app.use('/api/rms-export', rmsExportRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/calendar', calendarRoutes);

// API documentation endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'HR Workflow Management API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      jobs: '/api/jobs',
      candidates: '/api/candidates',
      interviews: '/api/interviews',
      tasks: '/api/tasks',
      communications: '/api/communications',
      analytics: '/api/analytics',
      settings: '/api/settings',
      files: '/api/files',
      assignments: '/api/assignments',
      automations: '/api/automations',
      activityLogs: '/api/activity-logs',
      planner: '/api/planner',
      calendar: '/api/calendar'
    },
  });
});

// Email test endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    
    // Default values for testing
    const testTo = to || 'test@example.com';
    const testSubject = subject || 'Test Email from HR Workflow';
    const testText = text || 'This is a test email from the HR Workflow Management system.';
    const testHtml = html || '<h2>Test Email</h2><p>This is a test email from the HR Workflow Management system.</p>';

    console.log('Sending test email...');
    const result = await emailService.sendEmail(testTo, testSubject, testText, testHtml);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        data: {
          to: testTo,
          subject: testSubject,
          messageId: result.messageId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Interview email isolation test — GET /api/test-interview-email?to=your@email.com
app.get('/api/test-interview-email', async (req, res) => {
  try {
    const { sendScheduledEmails } = await import('./services/interviewEmailService.js');
    const to = req.query.to || process.env.EMAIL_USER;
    await sendScheduledEmails({
      candidate_name: 'Test Candidate',
      candidate_email: to,
      interviewer_name: 'Test Interviewer',
      interviewer_email: to,
      job_role: 'Software Engineer',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
      time: '10:00',
      duration: 60,
      type: 'Technical',
      mode: 'Virtual',
      meeting_link: 'https://meet.example.com/test',
    });
    res.json({ success: true, message: `Interview test emails dispatched to ${to}` });
  } catch (err) {
    console.error('[test-interview-email]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve React frontend (dist/)
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

// React catch-all: any non-API route returns index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Server will not start.');
      process.exit(1);
    }

    await ensurePublicApplicationSchema().catch((err) => {
      console.warn('[PublicApplication] Schema setup warning:', err.message);
    });

    await ensureMergeSchema().catch((err) => {
      console.warn('[MergeSchema] Schema setup warning:', err.message);
    });

    // Start listening
    const server = app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🔗 API Base URL: http://localhost:${config.port}/api`);
      console.log(`❤️  Health Check: http://localhost:${config.port}/health`);

      // Start background jobs
      startNotificationCron();
      startAssignmentNotificationCron();
      startPlannerDailyResetCron();
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;

