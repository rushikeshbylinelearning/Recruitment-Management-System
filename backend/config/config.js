import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'hr_workflow_db'
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'hfdsjhsfuiewhyrfjsdbnfjsdhfjwdhfjsdh8493901nsjnjsan812u120',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    issuer: process.env.JWT_ISSUER || '',
    audience: process.env.JWT_AUDIENCE || ''
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  },
  
  // File Upload Configuration
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 1800000 // 30 minutes
  },
  
  // HR admin SPA (login, dashboard)
  frontendUrl: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')[0].trim().replace(/\/$/, '')
    : (process.env.NODE_ENV === 'production'
      ? 'https://hr.bylinelms.com'
      : 'http://localhost:5173'),

  // Public apply portal (candidate forms, short links)
  publicFrontendUrl: process.env.PUBLIC_FRONTEND_URL
    ? process.env.PUBLIC_FRONTEND_URL.split(',')[0].trim().replace(/\/$/, '')
    : (process.env.NODE_ENV === 'production'
      ? 'https://apply.bylinelms.com'
      : 'http://localhost:5173'),

  // CORS Configuration — both portals + local dev
  cors: {
    origin: (() => {
      const origins = new Set();
      const addList = (envVal) => {
        if (!envVal) return;
        envVal.split(',').forEach((u) => {
          const trimmed = u.trim();
          if (trimmed) origins.add(trimmed);
        });
      };
      addList(process.env.FRONTEND_URL);
      addList(process.env.PUBLIC_FRONTEND_URL);
      if (origins.size === 0) {
        return [
          'http://localhost:5173',
          'http://localhost:5174',
          'https://hr.bylinelms.com',
          'https://apply.bylinelms.com',
        ];
      }
      return [...origins];
    })(),
    credentials: true
  }
};

export default config;

